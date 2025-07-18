const fs=require('fs')
const key = fs.readFileSync("./sports-club-firebase-admin.json", "utf8"); // Synchronously reading a file called firebase-admin-service-key.json as UTF-8 text and storing its content in `key`

const base64 = Buffer.from(key).toString("base64"); // Converting the UTF-8 text into base64 format

console.log(base64)
