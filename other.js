// Crea la tabla si no existe
async function createTableIfNotExists(pool) {
    const createTableQuery = `
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='versionesSql' AND xtype='U')
        CREATE TABLE versionesSql (
            TargetId NVARCHAR(255),
            TargetVersionName NVARCHAR(255),
            UrlGetInfo NVARCHAR(MAX),
            LastVersion NVARCHAR(255),
            LastVersionDate DATE,
            LastVersionCheck DATETIME,
            ProcedureName NVARCHAR(255)
        );`;
    await pool.request().query(createTableQuery);
}


async function insertOrUpdateVersion(pool, targetId, targetVersionName, urlGetInfo, lastVersion, lastVersionDate) {
    await createTableIfNotExists(pool);

    const query = `
        IF NOT EXISTS (SELECT * FROM versionesSql WHERE LastVersion = @lastVersion)
        BEGIN
            INSERT INTO versionesSql(TargetId, TargetVersionName, UrlGetInfo, LastVersion, LastVersionDate, LastVersionCheck, ProcedureName)
            VALUES (@targetId, @targetVersionName, @urlGetInfo, @lastVersion, @lastVersionDate, GETDATE(), null);
        END
        ELSE
        BEGIN
            UPDATE versionesSql
            SET 
                TargetId = @targetId,
                TargetVersionName = @targetVersionName,
                UrlGetInfo = @urlGetInfo,
                LastVersionDate = @lastVersionDate,
                LastVersionCheck = GETDATE(),
                ProcedureName = null
            WHERE LastVersion = @lastVersion;
        END;`;

    await pool.request()
        .input('targetId', sql.NVarChar, targetId)
        .input('targetVersionName', sql.NVarChar, targetVersionName)
        .input('urlGetInfo', sql.NVarChar, urlGetInfo)
        .input('lastVersion', sql.NVarChar, lastVersion)
        .input('lastVersionDate', sql.Date, lastVersionDate)
        .query(query);
}