// https://learn.microsoft.com/en-us/sql/ssms/release-notes-ssms?view=sql-server-ver16
import puppeteer from "puppeteer";
import fs  from "fs";
import path from "path";

async function getDataFromWebPage(){
    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 100
    })

    const page = await browser.newPage();
    await page.goto('https://learn.microsoft.com/en-us/sql/ssms/release-notes-ssms?view=sql-server-ver16');

    const data = await page.evaluate(() =>{
        try{
            const headers = document.querySelectorAll('.content ul li');

            const versions = Array.from(headers)
                .filter(li => li.innerText.includes('Release number:'))
                .map(li => li.innerText.split(':')[1].trim());
                const compilacion = Array.from(headers)
                .filter(li => li.innerText.includes('Build number: '))
                .map(li => li.innerText.split(':')[1].trim());
                const fecha = Array.from(headers)
                .filter(li => li.innerText.includes('Release date:') || li.innerText.includes('Fecha de lanzamiento:'))
                .map(li => li.innerText.split(':')[1].trim());
                
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
        //metodo para formatear fechas en idioma ingles
        const formattedFirstRelease = formatDate(row.date)

        fullSSMSscript += `IF NOT EXISTS (SELECT * FROM versionesSSMS WHERE file_version = '${row.version}')
        BEGIN
            INSERT INTO versionesSSMS(file_version, compilation, release_date)
            VALUES ('${row.version}', '${row.compi}', '${formattedFirstRelease}');
        END
        ELSE
        BEGIN
            UPDATE versionesSSMS
            SET file_version = '${row.version}',
                compilation = '${row.compi}',
                release_date = '${formattedFirstRelease}'
            WHERE file_version = '${row.version}';
        END;\n\n`;
    }

    const filePath = path.join('versions', 'SSMS.sql');
    fs.writeFileSync(filePath, fullSSMSscript);
    console.log(`Script generado exitosamente y guardado en: ${filePath}`);

   
    await browser.close();
}

function formatDate(dateString) {
    if (dateString === 'TBA') return dateString;
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
}

getDataFromWebPage();
