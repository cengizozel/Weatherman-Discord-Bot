// Require the necessary discord.js classes
// const { Client, GatewayIntentBits } = require('discord.js');
// const fetch = require('node-fetch');

import dotenv from 'dotenv'
dotenv.config()

import { Client, GatewayIntentBits } from 'discord.js';
import fetch from 'node-fetch';
import got from 'got';

// Need to add 3 keys
// 1. Discord Bot Token
// 2. OpenWeatherMap API Key
// 3. OpenAI API Key
// 4. Serp Key

// Discord bot token
const TOKEN = process.env['discord_token'];

let conversationHistory = [];

const second = 1000;
const minute = second * 60;
const hour = minute * 60;
let start = new Date().getTime();
let now = new Date().getTime();

let isPaused = false;

// Create a new client instance
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
  ]
});

// When the client is ready, run this code (only once)
client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
  if (message.author.id === client.user.id) return;

  if (message.content === '!p') {
    if (isPaused) {
      message.channel.send("Conversation resuming.");
    } else {
      message.channel.send("Conversation paused.");
    }
    isPaused = !isPaused
    return;
  }

  if (isPaused) {
    return;
  }

  if (message.content === '!reset') {
    conversationHistory = [];
    message.channel.send("Conversation history reset.");
    return;
  }

  now = new Date().getTime();
  if (now - start > 1 * hour) {
    start = new Date().getTime();
    conversationHistory = [];
    console.log("\nResetting conversation history");
    message.react("🔄");
  } 
  // reset conversation if total number of characters in conversation history is greater than 1500
  else if (conversationHistory.join('').length > 1500) {
    conversationHistory = [];
    console.log("\nResetting conversation history");
    message.react("🔄");
  } else {
    console.log("Now: " + now + " Start: " + start);
    // Round to closest 2 decimal places
    console.log("\nTime passed in minutes: " + ((now - start) / minute).toFixed(2));
  }

  let getWeather = async (city) => {
    // OpenWeatherMap API key
    const key = process.env['openweathermap_key'];

    let response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${key}&units=metric`
    );

    let data = await response.json();

    return data;
  }

  let getGPT3 = async (prompt) => {
    const url = 'https://api.openai.com/v1/engines/text-davinci-002/completions';
    const params = {
      prompt: prompt + '\n',
      max_tokens: 1000,
      temperature: 0.7,
      top_p: 1,
      frequency_penalty: 1,
      presence_penalty: 0
    };

    // OpenAI API key
    const headers = {
      'Authorization': process.env['openai_key']
    };

    let response = await got.post(url, {
      json: params,
      headers: headers
    }).json();

    // console.log(response);
    console.log("Tokens spent: " + response.usage.total_tokens);

    let data = await response.choices[0].text;

    return data;
  }

  let getSerp = async (query) => {
    let response = await fetch(
      `https://serpapi.com/search.json?q=${query}&tbm=isch&ijn=0&api_key=${process.env['serp_key']}`
    );

    let data = await response.json();

    let max_random = 10;
    let random = Math.floor(Math.random() * max_random)
    console.log("Length is " + data.images_results.length);
    console.log("Selected random photo is " + random);
    let image = data.images_results[random].original;

    return image;
  }

  // Message action starts here

  // Check if message was sent in "weather" channel
  let channel_sent = message.channel.id
  let og_channel = '1018387866679771186'
  let test_channel = '1018550641393680384'
  if ((channel_sent !== og_channel) && (channel_sent !== test_channel)) {
    console.log("Message not sent to bot");
    return;
  }

  let message_content = message.content;

  // Ignore messages that start with "!"
  if (message_content.startsWith('!')) {
    return;
  }

  // Reset conversation history if message is "!reset"
  if (message_content == "!reset") {
    conversationHistory = [];
    message.channel.send("Conversation history reset.");
    return;
  }

  console.log("Message content: ", message_content);

  // Check for need for serpapi usage
  // check if message_content lowercased contains starts with "show me"
  if ((message_content.toLowerCase().startsWith("show me"))) {

    conversationHistory.push(message.author.username + ": " + message_content);

    let query = message_content.toLowerCase().split("show me ")[1];
    conversationHistory.push("Weatherman: " + "[Image of " + query + "]");

    console.log("Picture requested: " + query);

    let picture = await getSerp(query);

    console.log("Picture URL: ", picture);

    message.channel.send(
      picture
    );
    return
  }

  // Go through all the words in the message
  // If a word is "awwww", "awww", or "aww" then change it to a smiley face
  let awFound = false;
  const heart_emojis = ['❤️', '💛', '💚', '💙', '💜', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'];
  let words = message_content.split(" ");
  for (let i = 0; i < words.length; i++) {
    let word = words[i];
    word = word.toLowerCase();
    if ((word === 'awwww') || (word === 'awww') || (word === 'aww')) {
      awFound = true;
      message.react(heart_emojis[Math.floor(Math.random() * heart_emojis.length)]);
      words[i] = '😊';
    }
  }
  if (awFound) {
    console.log("New Message content: ", message_content);
    message_content = words.join(" ");
  }

  // Check for need for weather api usage
  let prompt = "Return true if message_content is asking the weather or for clothing suggestions. Return false if not.\n\n\
    message_content = \""+ message_content + "\"\n Answer with one word: true or false\n\n";

  let response = await getGPT3(prompt);
  response = response.toLowerCase();

  console.log("Is weather GPT3 response: ", response);

  if (response.includes("true")) {
    console.log("Weather or clothing suggestions requested.");

    let city = "Aktobe";

    let weather = await getWeather(city);

    let temp = weather.main.temp.toString();
    let temp_min = weather.main.temp_min.toString();
    let temp_max = weather.main.temp_max.toString();
    let wind = weather.wind.speed.toString();

    let windyText = " It is also going to be windy today, so be careful!";

    let isWindy = (wind > 10) ? true : false;

    let weatherText = `The weather in ${city} is ${weather.weather[0].main} with a temperature of ${temp}°C.`;
    // weatherText += 'The minimum temperature is ${temp_min}°C and the maximum temperature is ${temp_max}°C.';

    if (isWindy) {
      weatherText += windyText;
    }

    if (temp < 0) {
      weatherText += " It is very cold today, so make sure to wear a coat, a scarf, a hat and gloves.";
    } else if (temp < 10) {
      weatherText += " It is cold today, so make sure to wear a coat.";
    } else if (temp < 20) {
      weatherText += " It is pretty chill today, so I think you can wear a jacket or a long sleeve.";
    } else if (temp < 30) {
      weatherText += " It is warm outside, so you can wear a t-shirt and maybe shorts.";
    } else {
      weatherText += " It is hot outside, so make sure to wear a t-shirt and shorts.";
    }

    prompt = "Turn this text into a nice, informal message to my girlfriend: " + weatherText +
      "\n(Make sure to include the temperature and the clothes suggestions. Also, make sure to say that you love her and rarely mention that she is beautiful.\
            Call her either babe, baby, cutie, sweetheart, or my love. Don't put any unknown information in the message. Don't include closing signs like love, kisses, hugs, etc.)";

    let gpt3 = await getGPT3(prompt);

    // Remove all new lines from the GPT3 response
    gpt3 = gpt3.replace(/(\r\n|\n|\r)/gm, " ");

    console.log("GPT3 response to weather question: ", gpt3);

    message.channel.send(
      gpt3
    );
    return
  }
  
  else {
    // Add message by the user to the conversation history
    conversationHistory.push(message.author.username + ": " + message_content);

    let prompt = "Prompt: Carry this conversation\
        Give answers for only Weatherman.\
        You are talking to " + message.author.username + ".\
        Do not say similar things from the Conversation history.\
        Open different topics.\
        Conversation history:\n\n" + conversationHistory + "\n";

    console.log("General GPT3 Prompt: ", message_content);
    let gpt3 = await getGPT3(prompt);

    // If gpt3 response is empty, then make it "Your bofriend loves you."
    if (gpt3 === "") {
      console.log("GPT3 response is empty. Setting it to \"Your bofriend loves you.\"");
      gpt3 = "Your bofriend loves you.";
    }

    console.log("General GPT3 response: ", gpt3);

    let gpt3_send = "";

    // if (gpt3.includes("Y:")) {
    //   gpt3_send = gpt3.split("Y:")[1];
    //   if (gpt3_send.includes("X:")) {
    //     gpt3_send = gpt3_send.split("X:")[0];
    //   }
    // } else {
    //   gpt3_send = gpt3;
    // }

    // Remove new lines from the conversation history
    gpt3 = gpt3.replace(/(\r\n|\n|\r)/gm, "");
    // Remove any text in the beginning until the first : is found
    if (gpt3.includes(":")) {
      gpt3 = gpt3.split(":")[1];
    }


    let new_message = gpt3.toLowerCase().replace(/\s+/g, '')
    let old_message = conversationHistory[conversationHistory.length - 1].split(":")[1].toLowerCase().replace(/\s+/g, '')
    if (conversationHistory.length > 1)
    old_message = conversationHistory[conversationHistory.length - 2].split(":")[1].toLowerCase().replace(/\s+/g, '')
    console.log("new_message: ", new_message);
    console.log("old_message: ", old_message);
    if (new_message === old_message) {
      console.log("GPT3 response is the same as the previous message. Ignoring conversation history.");
      prompt = "Prompt: Carry this conversation\
      Give answers for only Weatherman.\
      You are talking to " + message.author.username + ".\
      Do not say similar things from the Conversation history.\
      Open different topics.\
      Conversation history:\n\n" + message_content + "\n";

      console.log("General GPT3 Prompt (no history): ", message_content);
      gpt3 = await getGPT3(prompt);

      if (gpt3 === "") {
        console.log("GPT3 response is empty. Setting it to \"Your bofriend loves you.\"");
        gpt3 = "Your bofriend loves you.";
      }
  
      console.log("General GPT3 response (no history): ", gpt3);

      // Remove new lines from the conversation history
      gpt3 = gpt3.replace(/(\r\n|\n|\r)/gm, "");
      // Remove any text in the beginning until the first : is found
      if (gpt3.includes(":")) {
        gpt3 = gpt3.split(":")[1];
      }
    } else {
      console.log("GPT3 response is not the same as the last message. Sending it.");
    }

    conversationHistory.push("Weatherman: " + gpt3);

    message.channel.send(
      gpt3
    );

    console.log("========================================");
    for (let i = 0; i < conversationHistory.length; i++) {
      // Remove new lines from the conversation history
      conversationHistory[i] = conversationHistory[i].replace(/(\r\n|\n|\r)/gm, " ");
    }
    console.log("Conversation history: ", conversationHistory);
    console.log("========================================");

  }
});

// Login to Discord with your client's token
client.login(TOKEN);
