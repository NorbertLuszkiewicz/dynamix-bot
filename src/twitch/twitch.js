const fastify = require("fastify");
const axios = require("axios");
const {
  addUser,
  getUser,
  updateUser,
  getAllUser
} = require("../controllers/UserController.js");

const TOKEN = "https://id.twitch.tv/oauth2/token";

const addNewUser = async code => {
  let accessToken;
  let refreshToken;
  const body = `grant_type=authorization_code&code=${code}&redirect_uri=${process.env.MY_APP_URL}/register&client_id=${process.env.BOT_CLIENT_ID}&client_secret=${process.env.BOT_CLIENT_SECRET}`;

  try {
    const { data } = await axios.post(`${TOKEN}`, body, {});
    const users = await getStreamerData(data.access_token);
    const userName = users.data[0].login;

    data.access_token && (accessToken = data.access_token);
    data.refresh_token && (refreshToken = data.refresh_token);

    const userInDatabase = await getUser(userName);

    if (userInDatabase.length === 0) {
      await addUser({
        streamer: userName,
        twitchAccessToken: data.access_token,
        twitchRefreshToken: data.refresh_token
      });
    } else {
      await updateUser({
        streamer: userName,
        twitchAccessToken: data.access_token,
        twitchRefreshToken: data.refresh_token
      });
    }

    return {
      status: "success",
      name: userName,
      token: data.access_token
    };
  } catch (err) {
    fastify.log.error(`Error while getting first token (${err})`);
    return "error";
  }
};

const refreshTwitchTokens = async () => {
  try {
    const streamers = await getAllUser();

    streamers.forEach(async streamer => {
      if (streamer.twitchAccessToken) {
        const [refreshToken] = await getUser(streamer.streamer);

        const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(
          refreshToken.twitchRefreshToken
        )}&client_id=${process.env.BOT_CLIENT_ID}&client_secret=${
          process.env.BOT_CLIENT_SECRET
        }`;

        const { data } = await axios.post(`${TOKEN}`, body, {});

        await updateUser({
          streamer: streamer.streamer,
          twitchAccessToken: data.access_token,
          twitchRefreshToken: data.refresh_token
        });
      }
    });
  } catch (err) {
    fastify.log.error(`Error while refreshing twitch tokens ${err}`);
  }
};

const getStreamerData = async accessToken => {
  try {
    const { data } = await axios.get("https://api.twitch.tv/helix/users", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Client-Id": "bhwlcwuvtg51226poslegrqdcm8naz"
      }
    });

    return data;
  } catch (err) {
    fastify.log.error(`Error while getting streamer data ${err}`);
  }
};

module.exports = {
  addNewUser,
  refreshTwitchTokens,
};
