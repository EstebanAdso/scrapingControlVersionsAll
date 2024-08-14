// https://www.sqlserverversions.com/#sql2022x
import puppeteer from "puppeteer";
import fs from "fs"; // Importar el módulo de sistema de archivos
import path from "path";

async function getDataFromWebPage() {
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100
    });
    const page = await browser.newPage();
    await page.goto('https://www.sqlserverversions.com/');

    const data = await page.evaluate(() => {
        const tables = document.querySelectorAll('div.oxa');
        let versionsData = {};

        const versionMapping = {
            1: '2022',
            2: '2019',
            3: '2017',
            4: '2016',
            5: '2014'
        };

        tables.forEach((table, index) => {
            if (index >= 1 && index <= 5) {
                const versionYear = versionMapping[index];
                let data = [];
                let stopConditionMet = false;

                const rows = table.querySelectorAll('table.tbl tbody tr');
                rows.forEach(row => {
                    if (stopConditionMet) return;

                    const columns = row.querySelectorAll('td');
                    if (columns.length >= 7) {
                        const build = columns[0].innerText;
                        const fileVersion = columns[2].innerText;
                        let kbDescription = columns[5].innerText.replace(/'/g, "''"); // Reemplazar comillas simples
                        const releaseDate = columns[6].querySelector('time') ? columns[6].querySelector('time').innerText : columns[6].innerText;

                        data.push({
                            build: build,
                            fileVersion: fileVersion,
                            kbDescription: kbDescription,
                            releaseDate: releaseDate
                        });

                        if ((index === 1 && build === '16.0.100.4') ||
                            (index === 2 && build === '15.0.1000.34') ||
                            (index === 3 && build === '14.0.1.246') ||
                            (index === 4 && build === '13.0.200.172') ||
                            (index === 5 && build === '11.0.9120.0')) {
                            stopConditionMet = true;
                            return;
                        }
                    }
                });

                versionsData[versionYear] = data;
            }
        });

        return versionsData;
    });

    await browser.close();

    let fullSqlScript = "USE VersionsControl;\n\n";

    fullSqlScript += `IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='versionesSql' AND xtype='U')
        BEGIN
        CREATE TABLE versionesSql (
            anio VARCHAR(4),
            build VARCHAR(255),
            file_version VARCHAR(255),
            description VARCHAR(MAX),
            release_date DATE
        );
        END;\n\n`;

    for (const [versionYear, results] of Object.entries(data)) {
        results.forEach(row => {
            const formattedDate = formatDate(row.releaseDate);
            fullSqlScript += `IF NOT EXISTS (SELECT * FROM versionesSql WHERE build = '${row.build}')
        BEGIN
            INSERT INTO versionesSql (anio, build, file_version, description, release_date)
            VALUES ('${versionYear}', '${row.build}', '${row.fileVersion}', '${row.kbDescription}', '${formattedDate}');
        END
        ELSE
        BEGIN
            UPDATE versionesSql
            SET anio = '${versionYear}',
                file_version = '${row.fileVersion}',
                description = '${row.kbDescription}',
                release_date = '${formattedDate}'
            WHERE build = '${row.build}';
        END;\n\n`;
        });
    }

    // Guardar el script SQL completo en un archivo
    const filePath = path.join('versions', 'SQL.sql');
    fs.writeFileSync(filePath, fullSqlScript);
    console.log(`Script generado exitosamente y guardado en: ${filePath}`);
}

function formatDate(dateString) {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-');
    return `${year}-${month}-${day}`;
}

getDataFromWebPage();