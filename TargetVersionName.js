import puppeteer from "puppeteer";
import sql from "mssql";

// Configuración de la conexión a SQL Server
const sqlConfig = {
    user: 'sa',
    password: '12345678',
    database: 'versionSql',
    server: 'DESKTOP-37SGVP0',
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    },
    options: {
        encrypt: false, // Usa true si estás en Azure
        trustServerCertificate: true // Cambia esto si es necesario
    }
};

// Función para formatear la fecha a YYYY-MM-DD
function formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}



// Inserta o actualiza la versión en la tabla
async function insertOrUpdateVersion(pool, targetId, targetVersionName, urlGetInfo, lastVersion, lastVersionDate) {
    await pool.request()
        .input('targetId', sql.VarChar, targetId)
        .input('targetVersionName', sql.VarChar, targetVersionName)
        .input('urlGetInfo', sql.VarChar, urlGetInfo)
        .input('lastVersion', sql.VarChar, lastVersion)
        .input('lastVersionDate', sql.Date, lastVersionDate)
        .execute('InsertOrUpdateVersion'); // Llamada al procedimiento almacenado
}

// Función principal para hacer scraping y almacenar datos en la base de datos
async function getDataFromWebPage() {
    const pool = await sql.connect(sqlConfig);
    const browser = await puppeteer.launch({ headless: false, slowMo: 20 });

    // Scraping para AirLiveDrive (ALD)
    const pageAld = await browser.newPage();
    await pageAld.goto('https://www.airlivedrive.com/en/download/');
    const dataAld = await pageAld.evaluate(() => {
        try {
            // Selecciona el primer h3 que contenga "version"
            const firstHeader = document.querySelector('.entry h3');
            const version = firstHeader ? firstHeader.innerText.split('version')[1].trim() : null;

            // Selecciona el primer párrafo que coincida con el patrón de fecha
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
        } catch (error) {
            console.error('Error en la evaluación de la página:', error);
            return { version: null, date: null };
        }
    });

    if (dataAld.version && dataAld.date) {
        const formattedDate = formatDate(dataAld.date);
        await insertOrUpdateVersion(pool, 'ALD2', 'AirLiveDrive', 'https://www.airlivedrive.com/en/download/', dataAld.version, formattedDate);
    }

    // Scraping para pgAdmin
    const pagePgAdmin = await browser.newPage();
    await pagePgAdmin.goto('https://www.pgadmin.org/news/');
    const dataPgAdmin = await pagePgAdmin.evaluate(() => {
        try {
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
        } catch (error) {
            console.error('Error en la navegación de la página:', error);
            return null;
        }
    });

    if (dataPgAdmin && dataPgAdmin.version && dataPgAdmin.date) {
        const formattedDate = formatDate(dataPgAdmin.date);
        await insertOrUpdateVersion(pool, 'PGA', 'pgAdmin', 'https://www.pgadmin.org/news/', dataPgAdmin.version, formattedDate);
    } else {
        console.log('No se encontraron datos válidos');
    }

    // Scraping para PostgreSQL
    const pagePgr = await browser.newPage();
    await pagePgr.goto('https://www.postgresql.org/support/versioning/');
    const dataPgr = await pagePgr.evaluate(() => {
        try {
            const table = document.querySelector('.table.table-striped');
            if (!table) throw new Error('Tabla no encontrada');

            const firstRow = table.querySelector('tbody tr');
            if (!firstRow) throw new Error('No se encontraron filas en la tabla');

            const cells = firstRow.querySelectorAll('td');
            return {
                version: cells[0].textContent.trim(),
                currentMinor: cells[1].textContent.trim(),
                supported: cells[2].textContent.trim(),
                firstRelease: cells[3].textContent.trim(),
                finalRelease: cells[4].textContent.trim()
            };
        } catch (error) {
            console.error('Error en la navegación de la página: ', error);
            return null;
        }
    });

    if (dataPgr) {
        const formattedDate = formatDate(dataPgr.finalRelease);
        await insertOrUpdateVersion(pool, 'PGR', 'PostgreSQL', 'https://www.postgresql.org/support/versioning/', dataPgr.currentMinor, formattedDate);
    } else {
        console.log('No se encontraron datos válidos');
    }

    // Scraping para SQL Server
    // Scraping para SQL Server
const pageSql = await browser.newPage();
await pageSql.goto('https://www.sqlserverversions.com/');
const { versionsData, targetIds, softwareVersionNames } = await pageSql.evaluate(() => {
    const tables = document.querySelectorAll('div.oxa');
    let versionsData = {};

    const targetYears = ['2014', '2017'];
    const targetIds = ['SQL12', 'SQL14'];
    const softwareVersionNames = ['SQLServer 2014', 'SQLServer 2017'];

    tables.forEach((table, index) => {
        if (index === 3 || index === 5) {
            const versionYear = targetYears[index === 3 ? 1 : 0];
            let data = null;

            const rows = table.querySelectorAll('table.tbl tbody tr');
            for (let row of rows) {
                const columns = row.querySelectorAll('td');
                if (columns.length >= 7) {
                    const build = columns[0].innerText;
                    const fileVersion = columns[2].innerText;
                    let kbDescription = columns[5].innerText.replace(/'/g, "''");
                    const releaseDate = columns[6].querySelector('time') ? columns[6].querySelector('time').innerText : columns[6].innerText;

                    data = {
                        build: build,
                        fileVersion: fileVersion,
                        kbDescription: kbDescription,
                        releaseDate: releaseDate
                    };

                    break; // Solo tomamos la primera fila
                }
            }

            if (data) {
                versionsData[versionYear] = [data];
            }
        }
    });

    return { versionsData, targetIds, softwareVersionNames };
});

    // Inserción para SQL Server 2014
    const targetId = targetIds[0];
    const softwareVersionName = softwareVersionNames[0];
    const results = versionsData['2014'];

    if (results && results.length > 0) {
        for (const row of results) {
            const formattedDate = formatDate(row.releaseDate);
            await insertOrUpdateVersion(pool, targetId, softwareVersionName, 'https://www.sqlserverversions.com/', row.build, formattedDate);
        }
    } else {
        console.log(`No se encontraron datos para el año 2014.`);
    }

    // Inserción para SQL Server 2017
    const targetId2 = targetIds[1];
    const softwareVersionName2 = softwareVersionNames[1];
    const results2 = versionsData['2017'];

    if (results2 && results2.length > 0) {
        for (const row of results2) {
            const formattedDate = formatDate(row.releaseDate);
            await insertOrUpdateVersion(pool, targetId2, softwareVersionName2, 'https://www.sqlserverversions.com/', row.build, formattedDate);
        }
    } else {
        console.log(`No se encontraron datos para el año 2017.`);
    }

    // Scraping para SSMS
    const pageSSMS = await browser.newPage();
    await pageSSMS.goto('https://learn.microsoft.com/en-us/sql/ssms/release-notes-ssms?view=sql-server-ver16');
    const dataSSMS = await pageSSMS.evaluate(() => {
        try {
            const headers = document.querySelectorAll('.content ul li');

            const version = Array.from(headers)
                .find(li => li.innerText.includes('Release number:'))
                ?.innerText.split(':')[1].trim();

            const compilacion = Array.from(headers)
                .find(li => li.innerText.includes('Build number: '))
                ?.innerText.split(':')[1].trim();

            const fecha = Array.from(headers)
                .find(li => li.innerText.includes('Release date:') || li.innerText.includes('Fecha de lanzamiento:'))
                ?.innerText.split(':')[1].trim();

            return {
                version,
                compilacion,
                fecha
            };

        } catch (error) {
            console.error('Error en la navegación de la página: ', error);
            return null;
        }
    });

    if (dataSSMS && dataSSMS.compilacion && dataSSMS.fecha) {
        const formattedDate = formatDate(dataSSMS.fecha);
        await insertOrUpdateVersion(pool, 'SSMS', 'SSMS', 'https://learn.microsoft.com/en-us/sql/ssms/release-notes-ssms?view=sql-server-ver16', dataSSMS.compilacion, formattedDate);
    }

    await browser.close();
    await pool.close();
}

getDataFromWebPage().catch(err => console.error('Error en el scraping:', err));
