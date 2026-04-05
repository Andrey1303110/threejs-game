var fs = require("fs");

module.exports = {
	cert: fs.readFileSync(__dirname + "/local.crt"),
	key: fs.readFileSync(__dirname + "/local.key"),
	passphrase: "12345"
};