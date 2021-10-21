const fastify = require("fastify");
const ComfyJS = require("comfy.js");
const { currentlyPlaying, nextSong } = require("../spotify/spotify.js");
const { songPlayingNow, timeRequest } = require("../streamElements/streamElements.js");

const commands = () =>
  (ComfyJS.onCommand = async (user, command, message, flags, extra) => {
    if (command == "song") {
      try {
        const spotifyData = await currentlyPlaying(extra.channel);
        const { isPlayingNow, title, link } = songPlayingNow(extra.channel);

        if (isPlayingNow) {
          ComfyJS.Say(`@${user} ${title} ${link}`, extra.channel);
        } else {
          let url = spotifyData.item.external_urls.spotify
            ? spotifyData.item.external_urls.spotify
            : "";
          let title = spotifyData.item.name
            ? spotifyData.item.name
            : "Nieznany tytuł utworu";
          let autor = "";
          if (
            spotifyData.item.artists.length > 0
          ) {
            spotifyData.item.artists.forEach(artist => {
              autor += artist.name + ", ";
            });
          }

          spotifyData &&
            ComfyJS.Say(
              `@${user} ${title} | ${autor} ${url}`,
              extra.channel
            );
        }
      } catch (err) {
        fastify.log.error(`Error when use !song on twitch (${err})`);
      }
    }

    if (command == "playlist" || command == "playlista") {
      try {
        const spotifyData = await currentlyPlaying(extra.channel);

        let url = spotifyData.context.external_urls
          ? spotifyData.context.external_urls.spotify
          : "Nieznana Playlista";

        spotifyData &&
          ComfyJS.Say(
            `@${user} aktualnie leci ta playlista: ${url} catJAM `,
            extra.channel
          );
      } catch (err) {
        fastify.log.error(`Error when use !playlist on twitch (${err})`);
      }
    }

    if (command == "next" && (flags.mod || flags.broadcaster)) {
      const { isPlayingNow } = songPlayingNow(extra.channel);
      if (isPlayingNow) {
        ComfyJS.Say("!skip", extra.channel);
        timeRequest(extra.channel, "skip");
      } else {
        nextSong(extra.channel);
      }
    }

    if (command === "dynamix" && (flags.mod || flags.broadcaster)) {
      ComfyJS.Say("Bot works!", extra.channel);
    }
  });

module.exports = {
  commands
};
