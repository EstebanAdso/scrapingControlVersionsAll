import puppeteer from "puppeteer";
import sql from "mssql";

const sqlConfig = {
    user: 'sa',
    password: '12345678',
    database: 'versionSql',
    server: 'DESKTOP-37SGVP0',
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    options: { encrypt: false, trustServerCertificate: true }
};

//Funcion para formatear fechas
const formatDate = (dateString) => {
    const date = new Date(dateString);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};


//Funcion para insertar o actualizar utilizando un procedimiento de sql
async function insertOrUpdateVersion(pool, targetId, BatchFileName, LastVersion, LastVersionDate, VersionDescription) {
    await pool.request()
        .input('targetId', sql.VarChar, targetId)
        .input('BatchFileName', sql.VarChar, BatchFileName)
        .input('LastVersion', sql.VarChar, LastVersion)
        .input('LastVersionDate', sql.Date, LastVersionDate)
        .input('VersionDescription', sql.VarChar, VersionDescription)
        .execute('mnt.insertorupdateversion');
}

//Funcion para Scrapear paginas
async function scrapePage(browser, url, evaluateFunction) {
    const page = await browser.newPage();
    await page.goto(url);
    return await page.evaluate(evaluateFunction);
}

//Funcion Principal
async function getDataFromWebPage() {
    const pool = await sql.connect(sqlConfig);
    const browser = await puppeteer.launch({ headless: false, slowMo: 20 });

    const scrapingTasks = [
        {
            name: 'AirLiveDrive',
            url: 'https://www.airlivedrive.com/en/download/',
            evaluate: () => {
                const firstHeader = document.querySelector('.entry h3');
                const version = firstHeader ? firstHeader.innerText.split('version')[1].trim() : null;
                const paragraphs = document.querySelectorAll('.col-md-8 p');
                const dateRegex = /^[A-Za-z]+ \d{1,2}, \d{4}$/;
                let date = null;
                for (let p of paragraphs) {
                    const line = p.innerText.split('\n')[0];
                    if (dateRegex.test(line)) {
                        date = line;
                        break;
                    }
                }
                return { version, date };
            },
            process: async (data) => {
                if (data.version && data.date) {
                    await insertOrUpdateVersion(pool, 'ALD2', 'Procedure', data.version, formatDate(data.date));
                }
            }
        },
        {
            name: 'pgAdmin',
            url: 'https://www.pgadmin.org/news/',
            evaluate: () => {
                const firstHeader = document.querySelector('h2 a');
                if (firstHeader && firstHeader.innerText.trim() !== '') {
                    const dateMatch = firstHeader.innerText.match(/^\d{4}-\d{2}-\d{2}/);
                    const versionMatch = firstHeader.innerText.match(/v(\d+\.\d+)/);
                    return {
                        version: versionMatch ? versionMatch[1] : null,
                        date: dateMatch ? dateMatch[0] : null
                    };
                }
                return null;
            },
            process: async (data) => {
                if (data && data.version && data.date) {
                    await insertOrUpdateVersion(pool, 'PGA', 'Procedure', data.version, formatDate(data.date));
                }
            }
        },
        {
            name: 'PostgreSQL',
            url: 'https://www.postgresql.org/support/versioning/',
            evaluate: () => {
                const table = document.querySelector('.table.table-striped');
                if (!table) return null;
                const firstRow = table.querySelector('tbody tr');
                if (!firstRow) return null;
                const cells = firstRow.querySelectorAll('td');
                return {
                    version: cells[0].textContent.trim(),
                    currentMinor: cells[1].textContent.trim(),
                    supported: cells[2].textContent.trim(),
                    firstRelease: cells[3].textContent.trim(),
                    finalRelease: cells[4].textContent.trim()
                };
            },
            process: async (data) => {
                if (data) {
                    await insertOrUpdateVersion(pool, 'PGR', 'Procedure', data.currentMinor, formatDate(data.finalRelease));
                }
            }
        },
        {
            name: 'SQL Server',
            url: 'https://www.sqlserverversions.com/',
            evaluate: () => {
                const tables = document.querySelectorAll('div.oxa');
                let versionsData = {};
                const targetYears = ['2014', '2017'];
                const targetIds = ['SQL12', 'SQL14'];
                const softwareVersionNames = ['SQLServer 2014', 'SQLServer 2017'];
        
                // Iterar sobre las tablas (índices 3 y 5 para 2014 y 2017)
                tables.forEach((table, index) => {
                    if (index === 3 || index === 5) {
                        const versionYear = targetYears[index === 3 ? 1 : 0]; // 2017 para index 3, 2014 para index 5
                        const rows = table.querySelectorAll('table.tbl tbody tr');
                        for (let row of rows) {
                            const columns = row.querySelectorAll('td');
                            if (columns.length >= 7) {
                                versionsData[versionYear] = [{
                                    build: columns[0].innerText,
                                    fileVersion: columns[2].innerText,
                                    kbDescription: columns[5].innerText.replace(/'/g, "''"), // Reemplazar comillas simples en kbDescription
                                    releaseDate: columns[6].querySelector('time') ? columns[6].querySelector('time').innerText : columns[6].innerText
                                }];
                                break;
                            }
                        }
                    }
                });
        
                return { versionsData, targetIds, softwareVersionNames };
            },
            process: async (data) => {
                for (let i = 0; i < 2; i++) {
                    const results = data.versionsData[i === 0 ? '2014' : '2017'];
                    if (results && results.length > 0) {
                        for (const row of results) {
                            // Ahora insertamos también kbDescription
                            await insertOrUpdateVersion(pool, data.targetIds[i], 'Procedure', row.build, formatDate(row.releaseDate), row.kbDescription);
                        }
                    }
                }
            }
        }
        ,
        {
            name: 'SSMS',
            url: 'https://learn.microsoft.com/en-us/sql/ssms/release-notes-ssms?view=sql-server-ver16',
            evaluate: () => {
                const headers = document.querySelectorAll('.content ul li');
                const version = Array.from(headers).find(li => li.innerText.includes('Release number:'))?.innerText.split(':')[1].trim();
                const compilacion = Array.from(headers).find(li => li.innerText.includes('Build number: '))?.innerText.split(':')[1].trim();
                const fecha = Array.from(headers).find(li => li.innerText.includes('Release date:') || li.innerText.includes('Fecha de lanzamiento:'))?.innerText.split(':')[1].trim();
                return { version, compilacion, fecha };
            },
            process: async (data) => {
                if (data && data.compilacion && data.fecha) {
                    await insertOrUpdateVersion(pool, 'SSMS', 'Procedure',  data.compilacion, formatDate(data.fecha));
                }
            }
        },
    ];

    for (const task of scrapingTasks) {
        try {
            const data = await scrapePage(browser, task.url, task.evaluate);
            await task.process(data);
        } catch (error) {
            console.error(`Error en el scraping de ${task.name}:`, error);
        }
    }

    await browser.close();
    await pool.close();
}

getDataFromWebPage().catch(err => console.error('Error en el scraping:', err));