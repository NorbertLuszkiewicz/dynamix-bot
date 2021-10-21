const fastify = require("fastify");
const ComfyJS = require("comfy.js");
const {
  nextSong,
  pauseSong,
  changeVolumeOnTime,
  setVolume,
} = require("../spotify/spotify");
const { updateUser, getUser, getAllUser } = require("../controllers/UserController.js");
const { songPlayingNow, timeRequest } = require("../streamElements/streamElements");

let timeoutVolume = {};

const setTimeoutVolume = async () => {
  try {
    const allUsers = await getAllUser();

    timeoutVolume = allUsers.reduce(
      (acc, key) => ({ ...acc, [key.streamer]: null }),
      {}
    );
  } catch {
    fastify.log.error("Error when call setTimeoutVolume on Twitch");
  }
};

const messages = () => {
  ComfyJS.onChat = async (user, message, flags, self, extra) => {
    try {
      const [data] = await getUser(extra.channel);
      const { addSongID, skipSongID, volumeSongID } = await data;

      if (flags.customReward && message === "add-song-award") {
        updateUser({
          streamer: extra.channel,
          addSongID: extra.customRewardId,
        });

        ComfyJS.Say(
          "Włączono automatyczne dodawanie piosenki przy zakupie tej nagrody",
          extra.channel
        );
      }
      if (flags.customReward && message === "skip-song-award") {
        updateUser({
          streamer: extra.channel,
          skipSongID: extra.customRewardId,
        });

        ComfyJS.Say(
          "Włączono automatyczne pomijanie piosenki przy zakupie tej nagrody",
          extra.channel
        );
      }
      if (message === "change-volume-song-award") {
        let newVolumeSongID = volumeSongID;
        newVolumeSongID.id = extra.customRewardId;

        updateUser({
          streamer: extra.channel,
          volumeSongID: newVolumeSongID,
        });

        ComfyJS.Say(
          "Włączono automatyczą zmiane głosności przy zakupie tej nagrody",
          extra.channel
        );
      }

      if (flags.customReward && extra.customRewardId === addSongID) {
        ComfyJS.Say("!sr " + message, extra.channel);
      }

      if (
        user === "StreamElements" &&
        (message.lastIndexOf("to the queue") != -1 ||
          message.lastIndexOf("do kolejki") != -1)
      ) {
        pauseSong(extra.channel);
        timeRequest(extra.channel, "add");
      }

      if (flags.customReward && extra.customRewardId === skipSongID) {
        const { isPlayingNow } = songPlayingNow(extra.channel);

        if (isPlayingNow) {
          await ComfyJS.Say("!skip", extra.channel);
          await timeRequest(extra.channel, "skip");
        } else {
          nextSong(extra.channel);
        }
      }

      const { id, min, max, minSR, maxSR, time } = volumeSongID

      if (volumeSongID && flags.customReward && extra.customRewardId === id) {
        ComfyJS.Say("!volume " + maxSR, extra.channel);
        changeVolumeOnTime(extra.channel, min, max, time);
        let [user] = await getUser(extra.channel);

        let newMaxVolumeTime = 0;
        let now = Date.now();

        if (user.maxVolumeTime > now) {
          newMaxVolumeTime = user.maxVolumeTime + time;
        }

        if (!user.maxVolumeTime || user.maxVolumeTime < now) {
          newMaxVolumeTime = now + time;
        }

        await updateUser({
          streamer: extra.channel,
          maxVolumeTime: newMaxVolumeTime,
        });

        clearTimeout(timeoutVolume[extra.channel]);
        timeoutVolume[extra.channel] = setTimeout(() => {
          ComfyJS.Say("!volume " + minSR, extra.channel);
        }, newMaxVolumeTime - now);
      }

      if (message == "skip" && user === "DynaM1X1") {
        try {
          const { isPlayingNow } = await songPlayingNow(extra.channel);
          if (isPlayingNow) {
            ComfyJS.Say("!skip", extra.channel);
            await timeRequest(extra.channel, "skip");
          } else {
            nextSong(extra.channel);
          }
        } catch (err) {
          fastify.log.error(`Error when skip song ${err}`);
        }
      }
    } catch (err) {
      fastify.log.error(`Error when use message ${err}`);
    }

    // volume [value] command
    const isVolumeCommand = message.lastIndexOf("volume");
    const volumeValue = message.substr(7);

    if (isVolumeCommand == 0 && (flags.mod || flags.broadcaster)) {
      setVolume(extra.channel, volumeValue);
    }

    // piramidka [emote] command
    const isPriamidka = message.lastIndexOf("piramidka");
    let emote = message.substr(9);
    !emote && (emote = "catJAM ");
    if (
      isPriamidka == 0 &&
      message.length < 30 &&
      (flags.mod || flags.broadcaster)
    ) {
      ComfyJS.Say(emote + " ", extra.channel);
      ComfyJS.Say(emote + " " + emote + " ", extra.channel);
      ComfyJS.Say(emote + " " + emote + " " + emote + " ", extra.channel);
      ComfyJS.Say(
        emote + " " + emote + " " + emote + " " + emote + " ",
        extra.channel
      );
      ComfyJS.Say(emote + " " + emote + " " + emote + " ", extra.channel);
      ComfyJS.Say(emote + " " + emote + " ", extra.channel);
      ComfyJS.Say(emote + " ", extra.channel);
    }
  };
};

module.exports = {
  messages,
  setTimeoutVolume,
};
