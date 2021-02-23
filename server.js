require('dotenv').config();
const express = require('express');
const http = require('http');
const { userInfo } = require('os');

const app = express();
const server = http.createServer(app);
const socket = require('socket.io');

const io = socket(server, {
  path: '/socket',
  // 프록시 없이 연결할 때.
  origins: ["http://localhost:3000", "https://witherview-webrtc.herokuapp.com/"],

  // optional, useful for custom headers
  handlePreflightRequest: (req, res) => {
    res.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST",
      "Access-Control-Allow-Credentials": true
    });
    res.end();
  }
});

const users = {};

const socketToRoom = {};

io.on('connection', (sock) => {
  sock.on('join room', (roomID) => {
    if (users[roomID]) {
      const { length } = users[roomID];
      if (length === 2) {
        socketToRoom.roomID = {};
        sock.emit('room full');
        return;
      }
      users[roomID].push(sock.id);
    } else {
      users[roomID] = [sock.id];
    }
    socketToRoom[sock.id] = roomID;

    const usersInThisRoom = users[roomID].filter((id) => id !== sock.id);

    sock.emit('all users', usersInThisRoom);
  });

  sock.on('sending signal', (payload) => {
    io.to(payload.userToSignal).emit('user joined', {
      signal: payload.signal,
      callerID: payload.callerID,
    });
  });

  sock.on('returning signal', (payload) => {
    io.to(payload.callerID).emit('receiving returned signal', {
      signal: payload.signal,
      id: sock.id,
    });
  });

  sock.on('next', () => {
    if (
      users[socketToRoom[sock.id]]
      && users[socketToRoom[sock.id]].length <= 2
    ) {
      users[socketToRoom[sock.id]].forEach((val) => {
        io.to(val).emit('clicked');
      });
    }
  });

  // todo: 브라우저 종료할 경우의 종료 로직.
  // 커넥션을 종료할 때
  sock.on('disconnect', () => {
    let roomID = socketToRoom.get(sock.id);
    if (roomID === undefined) { 
      // todo: 해당 방에 존재하지 않는 커넥션이 들어올 때. 예외처리가 필요할까?
      return;
    } 
    // 해당 방에 특정 유저가 떠났다는 user left 메시지를 보낸다.
    sock.broadcast.to(roomID).emit("user left", sock.id);

    // 서버에 저장된 데이터 삭제.
    socketToRoom.delete(sock.id);
    users[roomID].filter((id) => id !== sock.id);
  });
  // sock.on('disconnect', () => {
  //   if (
  //     users[socketToRoom[sock.id]]
  //     && users[socketToRoom[sock.id]].length <= 2
  //   ) {
  //     users[socketToRoom[sock.id]].forEach((val) => {
  //       io.to(val).emit('refresh');
  //     });
  //     users[socketToRoom[sock.id]] = users[socketToRoom[sock.id]].filter(
  //       (val) => val !== sock.id,
  //     );
  //   }
  //   delete socketToRoom[sock.id];
  // });
});

server.listen(process.env.PORT || 8000, () => console.log('server is running on port 8000'));
