const { server } = require("./src/node/server");
const config = require("./config.json");

(async () => {
    await server(config);
})();
