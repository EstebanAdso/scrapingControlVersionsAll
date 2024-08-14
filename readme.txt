npm init -y -- para inicializar el servidor nodeJs
npm i puppeteer -- para instalar puppeteer
npm i express --para instalar express
En el package.json usar "type": "module",
npm install -- en caso de instalar todas las dependencias de esta forma


Puppeteer
Puppeteer es una biblioteca de Node.js que proporciona una API para 
controlar navegadores web(Chrome o Chromium) de manera programática,
 permitiendo realizar tareas como scraping, pruebas automáticas, y generación de PDFs.

Puppeteer
Uso en el proyecto:
Puppeteer se utilizó para automatizar la navegación y extracción de datos desde una página web específica (https://www.sqlserverversions.com/).
 La función getDataFromWebPage en index.js lanza un navegador, navega a la página, extrae datos sobre las versiones de SQL Server, y luego genera
  un script SQL basado en esos datos.

Axios
Axios es una biblioteca de JavaScript utilizada para hacer solicitudes HTTP desde el navegador o Node.js,
 facilitando la comunicación con servidores y el manejo de respuestas.

 Axios
Uso en el proyecto:
Axios se utilizó en el archivo HTML para hacer una solicitud POST desde el frontend al backend. Cuando el usuario hace clic en el botón
 para generar el script SQL, Axios envía una solicitud al servidor Express para que ejecute la función de Puppeteer y retorne el script generado.

Express
Express es un framework web de Node.js minimalista y flexible, que proporciona un 
conjunto robusto de características para crear aplicaciones web y APIs, manejando rutas,
 middleware, y solicitudes HTTP.

 Express
Uso en el proyecto:
Express se utilizó para crear el servidor web que maneja las solicitudes HTTP. En server.js, se configura una ruta POST (/generate-sql-script)
 que, al recibir una solicitud, llama a la función getDataFromWebPage y devuelve el script SQL generado como respuesta.