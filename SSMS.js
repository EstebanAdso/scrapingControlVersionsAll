import puppeteer from "puppeteer";
import fs  from "fs";
import path from "path";

async function getDataFromWebPage(){
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100
    })

    const page = await browser.newPage();
    await page.goto('https://learn.microsoft.com/es-es/sql/ssms/release-notes-ssms?view=sql-server-ver16#previous-ssms-releases');

    const data = await page.evaluate(() =>{
        try{
            const headers = document.querySelectorAll('.content ul li');

            const versions = Array.from(headers)
                .filter(li => li.innerText.includes('Número de versión:'))
                .map(li => li.innerText);
                const compilacion = Array.from(headers)
                .filter(li => li.innerText.includes('Número de compilación:'))
                .map(li => li.innerText);
                const fecha = Array.from(headers)
                .filter(li => li.innerText.includes('Fecha de publicación:') || li.innerText.includes('Fecha de lanzamiento:'))

                .map(li => li.innerText)
                
            const length = Math.min(versions.length);
            const pairedData = [];

            for(let i = 0; i < length; i++){
                pairedData.push({
                    version: versions[i],
                    compi: compilacion[i],
                    date : fecha[i]
                })
            }

            return {pairedData};

        }catch(error){
            console.error('Error en la navegacion de la pagina: ', error)
            return null;
        }
    })
    // console.log(data)
    let fullSSMSscript = "USE VersionsControl;\n\n";

    fullSSMSscript += `IF NOT EXISTS(SELECT * FROM sysobjects where name = 'versionesSSMS' and xtype = 'U' )
    BEGIN
    CREATE TABLE versionesSSMS(
        file_version VARCHAR(255),
        compilation VARCHAR(255),
        release_date DATE
    );
    END;\n\n`;

    for (const row of data.pairedData) {
        fullSSMSscript += `IF NOT EXISTS (SELECT * FROM versionesSSMS WHERE file_version = '${row.version}')
        BEGIN
            INSERT INTO versionesSSMS(file_version, compilation, release_date)
            VALUES ('${row.version}', '${row.compi}', '${row.date}');
        END
        ELSE
        BEGIN
            UPDATE versionesSSMS
            SET file_version = '${row.version}',
                compilation = '${row.compi}',
                release_date = '${row.date}'
            WHERE file_version = '${row.version}';
        END;\n\n`;
    }

    const filePath = path.join('versions', 'SSMS.sql');
    fs.writeFileSync(filePath, fullSSMSscript);
    console.log(`Script generado exitosamente y guardado en: ${filePath}`);

   
    await browser.close();
}


getDataFromWebPage();
