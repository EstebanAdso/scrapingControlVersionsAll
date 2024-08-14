// https://www.airlivedrive.com/en/download/
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

async function getDataFromWebPage() {
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100
    });
    const page = await browser.newPage();
    await page.goto('https://www.airlivedrive.com/en/download/');

    const data = await page.evaluate(() => {
        try {
            const headers = document.querySelectorAll('.entry h3');
            const versions = Array.from(headers).map(h3 => h3.innerText.split('version')[1].trim());

            const paragraphs = document.querySelectorAll('.col-md-8 p');
            const dateRegex = /^[A-Za-z]+ \d{1,2}, \d{4}$/;
            const dates = Array.from(paragraphs)
                .map(p => p.innerText.split('\n')[0])
                .filter(line => dateRegex.test(line));
            
            const length = Math.min(versions.length, dates.length);
            const pairedData = [];

            for (let i = 0; i < length; i++) {
                pairedData.push({
                    header: versions[i],
                    date: dates[i]
                });
            }

            return { pairedData };
        } catch (error) {
            console.error('Error en la evaluación de la página:', error);
            return { pairedData: [] };
        }
    });

    let fullAldScript = "USE VersionsControl;\n\n";

    fullAldScript += `IF NOT EXISTS(SELECT * FROM sysobjects where name = 'versionesAld' and xtype = 'U' )
    BEGIN
    CREATE TABLE versionesAld(
        file_version VARCHAR(255),
        release_date DATE
    );
    END;\n\n`;

    for (const row of data.pairedData) {
        const fomattedDate = formatDate(row.date)
        fullAldScript += `IF NOT EXISTS (SELECT * FROM versionesAld WHERE file_version = '${row.header}')
        BEGIN
            INSERT INTO versionesAld(file_version, release_date)
            VALUES ('${row.header}', '${fomattedDate}');
        END
        ELSE
        BEGIN
            UPDATE versionesAld
            SET file_version = '${row.header}',
                release_date = '${fomattedDate}'
            WHERE file_version = '${row.header}';
        END;\n\n`;
    }

    const filePath = path.join('versions', 'ALD.sql');
    fs.writeFileSync(filePath, fullAldScript);
    console.log(`Script generado exitosamente y guardado en: ${filePath}`);

    await browser.close();
}
function formatDate(dateString) {
    const date = new Date(dateString);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${year}-${month}-${day}`;
}

getDataFromWebPage();