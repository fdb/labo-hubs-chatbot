const WebSocket = require("ws");

const ws = new WebSocket("wss://relaxed-werewolf.reticulum.io/socket/websocket?vsn=2.0.0");

const STATE_STARTING = "starting";
const STATE_JOINING = "joining";
const STATE_CONNECTED = "connected";

let state = STATE_STARTING;
let hubId = "KYwrXiG";
let fullHubId = `hub:${hubId}`;
let receiveId = 1;
let sendId = 1;
let botSessionId;
let vapidPublicKey;
let avatarId = "8DugdXZ";
let displayName = "MrRobot";
// Members keyed by session ID.
let members = {};
let chatStates = {};

let dialogOptions = [
  ["START", /(hello|hi)/, "Hi there!", "GREETED"],
  ["GREETED", /(hello|hi)/, "Hi again!", "ANNOYED"],
  ["GREETED", /(i hate you)/, "I hate you too!", "ANGRY"],
  ["ANNOYED", /(hello|hi)/, "I ALREADY SAID HI!!!", "START"],
  ["ANGRY", /(sorry)/, "I forgive you.", "GREETED"]
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
        context: { mobile: false, embed: false }
      });
    } else {
      console.log(`ERROR WHILE STARTING: ${JSON.stringify(body)}`);
    }
  } else if (command === "phx_reply" && state == STATE_JOINING) {
    if (body.status === "ok") {
      const hub = body.response.hubs[0];
      console.log(`Connected to ${hub.name}.`);
      state = STATE_CONNECTED;
    } else {
      console.log(`ERROR WHILE JOINING: ${JSON.stringify(body)}`);
    }
  } else if (command === "message" && state === STATE_CONNECTED) {
    console.log(body);
    handleChatMessage(body);
  } else if (command === "presence_diff") {
    console.log(body);
  } else {
    //console.log(`Unknown command ${command}`);
  }
}

function handleChatMessage(message) {
  if (message.type !== "chat") return;
  // This is the user that sent the message.
  const sessionId = message.session_id;
  // Ignore messages we sent ourselves.
  if (sessionId === botSessionId) return;
  const body = message.body.trim();
  let chatState = chatStates[sessionId] || "START";
  // Find a suitable dialog option.
  for (const [startState, input, output, endState] of dialogOptions) {
    if (startState !== chatState) continue;
    if (body.match(input)) {
      console.log(sessionId, chatState, output);
      sendMessage(fullHubId, "message", { body: output, type: "chat" });
      chatState = endState;
      chatStates[sessionId] = chatState;
      break;
    }
  }
}

ws.on("open", function() {
  sendMessage("ret", "phx_join", { hub_id: "T8NTTNr" });
});
ws.on("message", receiveMessage);
