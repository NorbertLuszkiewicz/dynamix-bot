const { MongoClient } = require("mongodb");
require("dotenv").config();
const fastify = require("fastify")({
  logger: {file: "./logs/combined"},
});
const { refreshAccessToken, setTimeoutVolume } = require("./src/spotify/spotify.js");
const {
  setTimeoutVolume: setTimeoutVolumeStreamElements,
} = require("./src/streamElements/streamElements");
const { refreshTwitchTokens } = require("./src/twitch/twitch.js");
const { twitchCommands } = require("./src/twitch/index.js");

const client = new MongoClient(
  `mongodb+srv://${process.env.MONGODB}&w=majority`,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

client.connect((err) => {
  if (err){
    fastify.log.error("Error with connect to database")
  }else{
    fastify.log.info("Database connected!");
    twitchCommands();
    setTimeoutVolume();
    setTimeoutVolumeStreamElements();
    refreshAccessToken()
    refreshTwitchTokens()
    setInterval(refreshAccessToken, 1800 * 1000);
    setInterval(refreshTwitchTokens, 9000 * 1000);
  }

});

fastify.register(require("fastify-cors"));
fastify.register(require("./routes"));

fastify.listen(process.env.PORT, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  fastify.log.info(`Server listening on ${address}`);
});
