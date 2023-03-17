const mongoose = require("mongoose");
const express = require("express");
const app = require("./app");

//MongoDB local Database Connection:
try {
  mongoose.connect("mongodb://127.0.0.1:27017/User");
  console.log("Data base connection succesfull");
} catch (err) {
  console.log(err);
}

/*Starting express Server:
when we run "node server.js" it imports app.js i.e object of module.exports,
and creates app{} object from express() method and starts server by listening
to the port 3000/PORT , by below code .
*/

app.listen(3000, () => {
  console.log("App is running on port 3000");
});
