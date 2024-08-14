import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

async function getDataFromWebPage() {
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100
    });

    const page = await browser.newPage();
    await page.goto('https://www.postgresql.org/support/versioning/')

    const data = await page.evaluate(() => {
        try {
            const table = document.querySelector('.table.table-striped');
            if (!table) throw new Error('Tabla no encontrada');

            const rows = table.querySelectorAll('tbody tr');
            const versions = Array.from(rows).map(row => {
                const cells = row.querySelectorAll('td');
                return {
                    version: cells[0].textContent.trim(),
                    currentMinor: cells[1].textContent.trim(),
                    supported: cells[2].textContent.trim(),
                    firstRelease: cells[3].textContent.trim(),
                    finalRelease: cells[4].textContent.trim()
                };
            });

            return versions;
        } catch (error) {
            console.error('Error en la navegación de la página: ', error);
            return null;
        }
    });
     // if (data) {
    //     console.log(data)
    // }
    let fullPgrScript = "USE VersionsControl;\n\n";

    fullPgrScript += `IF NOT EXISTS(SELECT * FROM sysobjects where name = 'versionesPGR' and xtype = 'U' )
    BEGIN
    CREATE TABLE versionesPGR(
        version varchar(15),
        file_version VARCHAR(255),
        supported VARCHAR(5),
        first_Release date,
        final_Release date,
    );
    END;\n\n`;

    for (const row of data) {
        fullPgrScript += `IF NOT EXISTS (SELECT * FROM versionesPGR WHERE file_version = '${row.currentMinor}')
        BEGIN
            INSERT INTO versionesPGR(version, file_version, supported, first_Release, final_Release)
            VALUES ('${row.version}', '${row.currentMinor}', '${row.supported}' , '${row.firstRelease}', '${row.finalRelease}');
        END
        ELSE
        BEGIN
            UPDATE versionesPGR
            SET version = '${row.version}'
                file_version = '${row.currentMinor}',
                supported = '${row.supported}',
                first_Release = '${row.firstRelease}',
                final_Release = '${row.finalRelease}'
            WHERE file_version = '${row.currentMinor}';
        END;\n\n`;
    }

    const filePath = path.join('versions', 'PGR.sql');
    fs.writeFileSync(filePath, fullPgrScript);
    console.log(`Script generado exitosamente y guardado en: ${filePath}`);
    

    await browser.close();
}

getDataFromWebPage();