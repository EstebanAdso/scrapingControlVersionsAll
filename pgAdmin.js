// https://www.pgadmin.org/news/
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

async function getDataFromWebPage() {
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100
    });

    const page = await browser.newPage();
    await page.goto('https://www.pgadmin.org/news/');

    const data = await page.evaluate(() => {
        try {
            const headers = document.querySelectorAll('h2 a');

            // Filtramos los <a> que no tengan texto
            const filteredHeaders = Array.from(headers).filter(a => a.innerText.trim() !== '');

            const dates = filteredHeaders.map(a => {
                const match = a.innerText.match(/^\d{4}-\d{2}-\d{2}/);
                return match ? match[0] : null; // Devuelve la fecha o null si no encuentra una coincidencia
            });

            const versions = filteredHeaders.map(a => {
                const match = a.innerText.match(/v\d+\.\d+/);
                return match ? match[0] : null; // Devuelve solo la versión o null si no encuentra una coincidencia
            });

            const length = Math.min(versions.length, dates.length);
            const pairedData = [];

            for (let i = 0; i < length; i++) {
                pairedData.push({
                    header: versions[i],
                    date: dates[i]
                })
            }

            return { pairedData };
        } catch (error) {
            console.error('Error en la navegación de la página:', error);
            return null;
        }
    });

    console.log(data);
    let fullPgAdminScript = "USE VersionsControl;\n\n";

    fullPgAdminScript += `IF NOT EXISTS(SELECT * FROM sysobjects where name = 'versionesPgAdmin' and xtype = 'U' )
    BEGIN
    CREATE TABLE versionesPgAdmin(
        file_version VARCHAR(255),
        release_date DATE
    );
    END;\n\n`;

    for (const row of data.pairedData) {
        const formattedDate = formatDate(row.date);
        fullPgAdminScript += `IF NOT EXISTS (SELECT * FROM versionesPgAdmin WHERE file_version = '${row.header}')
        BEGIN
            INSERT INTO versionesPgAdmin(file_version, release_date)
            VALUES ('${row.header}', '${formattedDate}');
        END
        ELSE
        BEGIN
            UPDATE versionesPgAdmin
            SET file_version = '${row.header}',
                release_date = '${formattedDate}'
            WHERE file_version = '${row.header}';
        END;\n\n`;
    }

    const filePath = path.join('versions', 'pgAdmin.sql');
    fs.writeFileSync(filePath, fullPgAdminScript);
    console.log(`Script generado exitosamente y guardado en: ${filePath}`);

    await browser.close();
}

function formatDate(dateString) {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-');
    return `${year}-${month}-${day}`;
}

getDataFromWebPage();