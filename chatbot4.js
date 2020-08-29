const WebSocket = require("ws");
const { Client } = require("node-osc");

const ws = new WebSocket("wss://relaxed-werewolf.reticulum.io/socket/websocket?vsn=2.0.0");

const STATE_STARTING = "starting";
const STATE_JOINING = "joining";
const STATE_CONNECTED = "connected";

let state = STATE_STARTING;
let hubId = "qPxWfFA";
let fullHubId = `hub:${hubId}`;
let receiveId = 1;
let sendId = 1;
let botSessionId;
let vapidPublicKey;
let avatarId = "qPxWfFA";
let displayName = "000";
// Members keyed by session ID.
let members = {};
let chatStates = {};

const oscClient = new Client("127.0.0.1", 3333);

let dialogOptions = [
  ["START", /(hello|hi)/, `Welcome to my world, $NAME.`, "START"],

  ["START", /(hello|hi)/, "Welcome to my world, stranger.", "START"],

  ["START", /(shell)/, "One correct $NAME!", "SHELL"],
  ["START", /(mirror)/, "One correct $NAME!", "MIRROR"],
  ["START", /(computer)/, "One correct $NAME!", "COMPUTER"],

  ["SHELL", /(shell)/, "You already said that!!", "SHELL"],
  ["SHELL", /(mirror)/, "Two correct!", "SHELL_MIRROR"],
  ["SHELL", /(computer)/, "Two correct!", "SHELL_COMPUTER"],

  ["SHELL_COMPUTER", /(shell|computer)/, "You already said that!", "SHELL_COMPUTER"],
  ["SHELL_COMPUTER", /(mirror)/, "Well done!", "START"],
  ["SHELL_MIRROR", /(shell|mirror)/, "You already said that!", "SHELL_MIRROR"],
  ["SHELL_MIRROR", /(computer)/, "Ahhhhh...... the number of the portal is... 32!", "WIN"],

  ["MIRROR", /(mirror)/, "You already said that!!", "MIRROR"],
  ["MIRROR", /(shell)/, "Two correct!", "MIRROR_SHELL"],
  ["MIRROR", /(computer)/, "Two correct!", "MIRROR_COMPUTER"],

  ["MIRROR_COMPUTER", /(mirror|computer)/, "You already said that!", "MIRROR_COMPUTER"],
  ["MIRROR_COMPUTER", /(shell)/, "Well done!", "START"],
  ["MIRROR_SHELL", /(shell|mirror)/, "You already said that!", "MIRROR_COMPUTER"],
  ["MIRROR_SHELL", /(computer)/, "Ahhhhh...... the number of the portal is... 32!", "WIN"],

  ["COMPUTER", /(comptuer)/, "You already said that!!", "COMPUTER"],
  ["COMPUTER", /(mirror)/, "Two correct!", "COMPUTER_MIRROR"],
  ["COMPUTER", /(shell)/, "Two correct!", "COMPUTER_SHELL"],

  ["COMPUTER_SHELL", /(shell|computer)/, "You already said that!", "COMPUTER_SHELL"],
  ["COMPUTER_SHELL", /(mirror)/, "Well done!", "START"],
  ["COMPUTER_MIRROR", /(computer|mirror)/, "You already said that!", "COMPUTER_MIRROR"],
  ["COMPUTER_MIRROR", /(shell)/, "Ahhhhh...... the number of the portal is... 32!", "WIN"],

  // Guessing game
];

function sendMessage(roomId, command, body) {
  const message = JSON.stringify([receiveId, sendId, roomId, command, body]);
  ws.send(message);
  sendId++;
}

function receiveMessage(data) {
  const [n1, n2, channel, command, body] = JSON.parse(data);
  if (Number.isInteger(n1)) {
    receiveId = n1;
  }
  if (command === "phx_reply" && state === STATE_STARTING) {
    if (body.status === "ok") {
      console.log("Joining Hubs...");
      state = STATE_JOINING;
      botSessionId = body.response.session_id;
      vapidPublicKey = body.response.vapid_public_key;
      sendMessage(fullHubId, "phx_join", {
        profile: { avatarId, displayName },
        auth_token: null,
        perms_token: null,
        context: { mobile: false, embed: false },
      });
    } else {
      console.log(`ERROR WHILE STARTING: ${JSON.stringify(body)}`);
    }
  } else if (command === "phx_reply" && state == STATE_JOINING) {
    if (body.status === "ok") {
      const hub = body.response.hubs[0];
      console.log(`Connected to ${hub.name}.`);
      state = STATE_CONNECTED;
      setInterval(sendHeartbeat, 30000);
    } else {
      console.log(`ERROR WHILE JOINING: ${JSON.stringify(body)}`);
    }
  } else if (command === "message" && state === STATE_CONNECTED) {
    console.log(body);
    handleChatMessage(body);
  } else if (command === "presence_diff") {
    for (const sessionId of Object.keys(body.joins)) {
      if (sessionId === botSessionId) continue;
      const meta = body.joins[sessionId].metas[0];
      if (meta.presence !== "room") continue;
      const displayName = meta.profile.displayName;
      console.log(`${displayName} joined.`);
      members[sessionId] = {
        displayName,
      };
      const message = `Welcome, dear ${displayName}, to my attic...... I like to listen here for any sounds from the outside.. so few come in... Stay here among the paintings for awhile, you will see there is no way out.... But let's play a game! 
      In each of these images, there is one element which you must name... For each image, this will be the most central object. But beware! Name all of the elements, and I shall steal your voice. Lo, I shall join the other world. You shall also be set free, for I shall tell you the secret of the portal.............................`;
      sendMessage(fullHubId, "message", { body: message, type: "chat" });
    }

    for (const sessionId of Object.keys(body.leaves)) {
      const meta = body.leaves[sessionId].metas[0];
      if (meta.presence !== "room") continue;
      const displayName = meta.profile.displayName;
      console.log(`${displayName} left.`);
      delete members[sessionId];
    }
  } else if (command === "presence_state") {
    try {
      for (const sessionId of Object.keys(body)) {
        const meta = body[sessionId].metas[0];
        if (meta.presence !== "room") continue;
        members[sessionId] = {
          displayName: meta.profile.displayName,
        };
        console.log(`${meta.profile.displayName} is here.`);
      }
    } catch (e) {
      // Ignore
    }
  } else {
    //console.log(`Unknown command ${command}`);
  }
}

function handleChatMessage(message) {
  if (message.type !== "chat") return;
  // This is the user that sent the message.
  const sessionId = message.session_id;
  // Find the user's session.
  const user = members[sessionId];
  // Ignore messages we sent ourselves.
  if (sessionId === botSessionId) return;
  const body = message.body.trim();
  let chatState = chatStates[sessionId] || "START";
  // Find a suitable dialog option.
  for (const [startState, input, output, endState] of dialogOptions) {
    if (startState !== chatState) continue;
    if (body.match(input)) {
      let message = output.replace("$NAME", user ? user.displayName : "Stranger");
      console.log(sessionId, chatState, output);
      setTimeout(() => {
        sendMessage(fullHubId, "message", { body: message, type: "chat" });
        chatState = endState;
        chatStates[sessionId] = chatState;
        if (chatState === "WIN") {
          oscClient.send("/win");
          chatStates[sessionId] = "START";
        }
      }, 500 + Math.random() * 1000);
      break;
    }
  }
}

function sendHeartbeat() {
  sendMessage("phoenix", "heartbeat", {});
}

ws.on("open", function () {
  sendMessage("ret", "phx_join", { hub_id: hubId });
});
ws.on("message", receiveMessage);
