const fastify = require("fastify")
const axios = require("axios");
const {
  getAllUser,
  updateUser,
  getUser,
} = require("../controllers/UserController.js");

const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const AUTHORIZE = "https://accounts.spotify.com/authorize";
const TOKEN = "https://accounts.spotify.com/api/token";
const PLAY = "https://api.spotify.com/v1/me/player/play";
const PAUSE = "https://api.spotify.com/v1/me/player/pause";
const NEXT = "https://api.spotify.com/v1/me/player/next";
const VOLUME = "https://api.spotify.com/v1/me/player/volume";
const PLAYER = "https://api.spotify.com/v1/me/player";
const DEVICES = "https://api.spotify.com/v1/me/player/devices";

let timeoutVolume = {};

const setTimeoutVolume = async () => {
  try {
    const allUsers = await getAllUser();
    timeoutVolume = allUsers.reduce(
      (acc, key) => ({ ...acc, [key.streamer]: null }),
      {}
    );
  } catch {
    fastify.log.error("Error when call setTimeoutVolume on Spotify");
  }
};

const addSpotify = async (streamer, code) => {
  let accessToken;
  let refreshToken;
  const body = `grant_type=authorization_code&code=${code}&redirect_uri=${process.env.MY_APP_URL}/callback`;

  try {
    const { data } = await axios.post(`${TOKEN}`, body, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(
          clientId + ":" + clientSecret
        ).toString("base64")}`,
      },
    });
    data.access_token && (accessToken = data.access_token);
    data.refresh_token && (refreshToken = data.refresh_token);

    await updateUser({
      streamer: streamer,
      spotifyAccessToken: data.access_token,
      spotifyRefreshToken: data.refresh_token,
    });

    return "success";
  } catch (err) {
    fastify.log.error(`Error while getting first token (${err})`);
    return err;
  }
};

const startSong = async (streamer) => {
  const [user] = await getUser(streamer);
  const { spotifyAccessToken, device } = user;

  try {
    return await axios.put(
      `${PLAY}?device_id=${device}`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${spotifyAccessToken}`,
        },
      }
    );
  } catch ({ response }) {
    fastify.log.error(
      `Error while starting song (${response.status} ${response.statusText})`
    );
  }
};

const pauseSong = async (streamer) => {
  try {
    const [user] = await getUser(streamer);
    const { spotifyAccessToken, device } = user;

    return await axios.put(
      `${PAUSE}?device_id=${device}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${spotifyAccessToken}`,
        },
      }
    );
  } catch ({ response }) {
    fastify.log.error(
      `Error while stopping song (${response.status} ${response.statusText})`
    );
  }
};

const nextSong = async (streamer) => {
  try {
    const [user] = await getUser(streamer);
    const { spotifyAccessToken, device } = user;
    return await axios.post(
      `${NEXT}?device_id=${device}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${spotifyAccessToken}`,
        },
      }
    );
  } catch ({ response }) {
    fastify.log.error(
      `Error while skipping song (${response.status} ${response.statusText})`
    );
  }
};

const changeVolumeOnTime = async (streamer, min, max, time) => {
  try {
    let [user] = await getUser(streamer);
    let { spotifyAccessToken, device, maxVolumeTime } = user;
    let newMaxVolumeTime = 0;

    await axios.put(
      `${VOLUME}?volume_percent=${max}&device_id=${device}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${spotifyAccessToken}`,
        },
      }
    );

    let now = Date.now();

    if (maxVolumeTime > now) {
      newMaxVolumeTime = maxVolumeTime + time;
    }

    if (!maxVolumeTime || maxVolumeTime < now) {
      newMaxVolumeTime = now + time;
    }

    await updateUser({
      streamer: streamer,
      maxVolumeTime: newMaxVolumeTime,
    });

    clearTimeout(timeoutVolume[streamer]);
    timeoutVolume[streamer] = setTimeout(
      async () => {
        try {
          await axios.put(
            `${VOLUME}?volume_percent=${min}&device_id=${device}`,
            {},
            {
              headers: {
                Authorization: `Bearer ${spotifyAccessToken}`,
              },
            }
          );
        } catch ({ response }) {
          fastify.log.error(
            `Error while volume changes to lower (${response.status} ${response.statusText})`
          );
        }
      },
      newMaxVolumeTime - now,
      streamer
    );
  } catch ({ response }) {
    fastify.log.error(
      `Error while volume changes to higher (${response.status} ${response.statusText})`
    );
  }
};

const setVolume = async (streamer, value) => {
  try {
    const [user] = await getUser(streamer);
    const { spotifyAccessToken, device } = user;

    return await axios.put(
      `${VOLUME}?volume_percent=${value}&device_id=${device}`,
      {},
      {
        headers: {
          Authorization: `Bearer ${spotifyAccessToken}`,
        },
      }
    );
  } catch ({ response }) {
    fastify.log.error(
      `Error while volume changes (${response.status} ${response.statusText})`
    );
  }
};

const refreshAccessToken = async () => {
  try {
    const streamers = await getAllUser();

    streamers.forEach(async (streamer) => {
      if (streamer.streamer != "og1ii" && streamer.spotifyRefreshToken) {
        const body = `grant_type=refresh_token&refresh_token=${streamer.spotifyRefreshToken}&client_id=${clientId}`;

        const { data } = await axios.post(`${TOKEN}`, body, {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${Buffer.from(
              clientId + ":" + clientSecret
            ).toString("base64")}`,
          },
        });

        await updateUser({
          streamer: streamer.streamer,
          spotifyAccessToken: data.access_token,
          spotifyRefreshToken: data.refresh_token,
        });
      }
    });
  } catch ({ response }) {
    fastify.log.error(
      `Error while resetting Spotify token (${response.status} ${response.statusText})`
    );
  }
};

const currentlyPlaying = async (streamer) => {
  try {
    const [user] = await getUser(streamer);
    const { spotifyAccessToken } = user;

    const { data } = await axios.get(`${PLAYER}?market=US`, {
      headers: {
        Authorization: `Bearer ${spotifyAccessToken}`,
      },
    });

    return data;
  } catch ({ response }) {
    fastify.log.error(
      `Error while getting currently song (${response.status} ${response.statusText})`
    );
  }
};

const refreshDevices = async (streamer) => {
  try {
    const [user] = await getUser(streamer);
    const { spotifyAccessToken } = user;

    const { data } = await axios.get(DEVICES, {
      headers: {
        Authorization: `Bearer ${spotifyAccessToken}`,
      },
    });
    fastify.log.error("devices", data);
    const device = data.devices.find((element) => element.is_active)
      ? data.devices.find((element) => element.is_active)
      : data.devices[0];

    await updateUser({
      streamer: streamer,
      device: device.id,
    });
  } catch ({ response }) {
    fastify.log.error(
      `Error while getting devices (${response.status} ${response.statusText})`
    );
  }
};

module.exports = {
  pauseSong,
  startSong,
  nextSong,
  refreshAccessToken,
  refreshDevices,
  changeVolumeOnTime,
  setVolume,
  currentlyPlaying,
  addSpotify,
  setTimeoutVolume,
};
