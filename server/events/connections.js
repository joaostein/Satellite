var db = require('../db/queries');
var globals = require('./globals'); 

module.exports = function (map, host, Sync, io) {
  return {
    join: function( socket, data ) {
      var target;
      if(host.rooms[data.room] === undefined) {
        host.init(socket, data.room, data);
        target = host.rooms[data.room];
        Sync.setInit( socket, target, data );
        host.rooms[data.room].sync(io, data.room);
        
        host.rooms[data.room].bot = globals();
        target.bot.lastClient = socket.id;
        target.bot.clients[socket.id] = true; 
        
      } else {
        host.add(socket, data.room, data);
        target = host.rooms[data.room];
        Sync.setInit( socket, target, data );

        target.bot.lastClient = socket.id;
        target.bot.clients[socket.id] = true; 
      }

      db.joinRoom(data.room, data.name);  // add to game in the db

      socket.emit('player list', target.playerList);
      socket.emit('map', map.mapItems);
      socket.join(data.room);
      socket.broadcast.to(data.room).emit('join', data);

      
      for (var key in target.bot.clients) {
        if (!target.bot.hostPlayer) {
          target.bot.hostPlayer = key;
        }
        break;
      }
      io.sockets.socket(target.bot.hostPlayer).emit("bot retrieval");
    },

    disconnect: function( socket ) {
      var room = host.sockets[socket.id].room;
      var name = host.sockets[socket.id].name;
      var target = host.rooms[room].bot; 
     
      if(room === undefined || name === undefined || target === undefined) {
        socket.disconnect(true);
        return console.log("Something is undefined on line 50, aborting.");
      }
      
      db.leaveRoom(room, name); 

      delete target.clients[socket.id];
      if (target.hostPlayer === socket.id) {
        for (var key in target.clients) {
          target.hostPlayer = key;
          io.sockets.socket(target.hostPlayer).emit("bot retrieval");
          break;
        }
      }
      

      socket.broadcast.to(room).emit('leave', {name: name});
      socket.leave(room);
      delete host.rooms[room].gamestate[name];
      delete host.rooms[room].playerList[name];
      delete host.sockets[socket.id];
    },

    change: function( socket, room ) {
      if(host.sockets[socket.id] === undefined) {
        socket.disconnect(true);
        return console.log("There was an error in changing rooms, aborting, please reconnect!");
      }
      var myData = {};
      for(var i in host.sockets[socket.id]) {
        myData[i] = host.sockets[socket.id][i];
      }

      this.disconnect(socket);
      this.join( socket, room );
    },

    query: function( socket ) {
      var rooms = host.rooms;
      socket.emit('roomQuery', Object.keys(rooms));
    }

  };
};
