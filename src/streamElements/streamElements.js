const fastify = require("fastify")
const axios = require("axios");
const { startSong } = require("../spotify/spotify");
const {
  getAllUser,
  updateUser,
  getUser,
} = require("../controllers/UserController.js");

const url = "https://api.streamelements.com/kappa/v2/";

let timeoutVolume = {};

const setTimeoutVolume = async () => {
  try {
    const allUsers = await getAllUser();

    timeoutVolume = allUsers.reduce(
      (acc, key) => ({ ...acc, [key.streamer]: null }),
      {}
    );
  } catch {
    fastify.log.error("Error when call setTimeoutVolume on StreamElements");
  }
};

const getSpotifyAreaData = async (streamer, area) => {
  try {
    const [user] = await getUser(streamer);
    const { clientSongRequestID, clientSongRequestSecret } = user;

    const { data } = await axios.get(
      `${url}songrequest/${clientSongRequestID}/${area}`,
      {
        headers: {
          Authorization: `Bearer ${clientSongRequestSecret}`,
        },
      }
    );

    return data;
  } catch ({ response }) {
    fastify.log.error(
      `Error while getting ${area} (${response.status} ${response.statusText})`
    );
  }
};

const songPlayingNow = async (streamer) => {
  try {
    const player = await getSpotifyAreaData(streamer, "player");
    const playing = await getSpotifyAreaData(streamer, "playing");

    return {
      isPlayingNow: player.state == "playing" && playing != null,
      title: playing && playing.title,
      link: playing && `https://www.youtube.com/watch?v=${playing.videoId}`,
    };
  } catch (err) {
    fastify.log.error(`Error while checking what song playing now ${err}`);
  }
};

const timeRequest = async (streamer, action) => {
  try {
    let playing = await getSpotifyAreaData(streamer, "playing");
    const queue = await getSpotifyAreaData(streamer, "queue");
    const [user] = await getUser(streamer);
    const { endTime } = user;

    let now = Date.now();

    if (action === "add") {
      let newEndTime;

      if (playing && playing.duration && queue.length == 0) {
        newEndTime = playing.duration * 1000;

        await updateUser({
          streamer: streamer,
          endTime: newEndTime + now,
        });
      }

      if (!playing && queue.length == 1) {
        newEndTime = queue[0].duration * 1000;

        await updateUser({
          streamer: streamer,
          endTime: newEndTime + now,
        });
      }

      if (playing && queue.length > 0) {
        if (endTime > now) {
          newEndTime = endTime - now + queue[queue.length - 1].duration * 1000;

          await updateUser({
            streamer: streamer,
            endTime: newEndTime + now,
          });
        } else {
          let allQueueTimes = 0;
          queue.forEach((song) => (allQueueTimes += song.duration));

          newEndTime = (allQueueTimes + playing.duration) * 1000;

          await updateUser({
            streamer: streamer,
            endTime: newEndTime + now,
          });
        }
      }

      clearTimeout(timeoutVolume[streamer]);

      timeoutVolume[streamer] = setTimeout(async () => {
        playing = await getSpotifyAreaData(streamer, "playing");

        !playing && startSong(streamer);
      }, newEndTime + 1350 * (queue.length + 3));
    }
    if (action === "skip") {
      if (playing) {
        let timeOfSongsInQueue = 0;
        queue.length > 0
          ? queue.forEach((song) => (timeOfSongsInQueue += song.duration))
          : (timeOfSongsInQueue = 0);

        const timeOfAllSongs = (playing.duration + timeOfSongsInQueue) * 1000;

        await updateUser({
          streamer: streamer,
          endTime: timeOfAllSongs + now,
        });

        clearTimeout(timeoutVolume[streamer]);

        timeoutVolume[streamer] = setTimeout(async () => {
          playing = await getSpotifyAreaData(streamer, "playing");

          !playing && startSong(streamer);
        }, timeOfAllSongs + 1000 * (queue.length + 1));
      } else {
        startSong(streamer);
      }
    }
  } catch (err) {
    fastify.log.error(`Error while changging volume on time ${err}`);
  }
};

module.exports = {
  songPlayingNow,
  timeRequest,
  setTimeoutVolume,
};
