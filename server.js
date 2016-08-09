// Copyright (c) 2015, maldicion069 (Cristian Rodríguez) <ccrisrober@gmail.con>
//
// Permission to use, copy, modify, and/or distribute this software for any
// purpose with or without fee is hereby granted, provided that the above
// copyright notice and this permission notice appear in all copies.
//
// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
// WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
// ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
// WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
// ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
// OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.package com.example

// Generated by CoffeeScript 1.9.0
(function() {
  var KeyObject, Map, ObjectUser, async, clone, fs, keys, maps, mysql, net, pool, sockets, sys, users_sockets, util;

  sys = require("sys");

  net = require("net");

  util = require("util");

  fs = require("fs");

  clone = require('clone');

  ObjectUser = require("./ObjectUser.js");

  Map = require("./Map.js");

  KeyObject = require("./KeyObject.js");

  mysql = require("mysql");

  async = require("async");

  sockets = [];

  users_sockets = {};

  maps = [];

  keys = {};

  pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "",
    database: "tfg_gis"
  });

  pool.getConnection(function(err, connection) {
    return connection.query("UPDATE `users` SET `isAlive`=0;", function(err, res) {
      return connection.query("SELECT o.color, o.id, om.posX, om.posY, om.admin FROM object_map om INNER JOIN object o ON o.id = om.id_obj WHERE om.id_map=1;", function(err, rows, fields) {
        var i, len, svr, svraddr, svrport;
        len = rows.length;
        i = 0;
        while (i < len) {
          RealObjects[rows[i].id] = new KeyObject(rows[i].id, rows[i].posX, rows[i].posY, rows[i].color);
          i++;
        }
        connection.query("SELECT * FROM `map` WHERE `id`= 1;", function(err, rows2, fields) {
          var ks_0;
          ks_0 = [];
          len = rows.length;
          i = 0;
          while (i < len) {
            if (RealObjects[rows[i].id] && rows[i].admin === null) {
              ks_0.push(RealObjects[rows[i].id]);
            }
            i++;
          }
          console.log("KS: " + ks_0);
          return maps.push(new Map(rows2[0].id, rows2[0].mapFields, rows2[0].width, rows2[0].height, ks_0));
        });
        svr = net.createServer(function(sock) {
          var newConnectionWarningUser, randomValue, sendDiePlayerAndWinnerToShow, sendFightToAnotherClient, sendMap, sendPosition;
          sendMap = function(num_map, user) {
            var map;
            map = clone(maps[num_map]);
            delete map.RealObjects;
            connection.query('SELECT `port`, `posX`, `posY` FROM `users` WHERE `isAlive`=1;', function(err, rows) {
              return async.series({
                one: function(callback) {
                  var users;
                  users = {};
                  return async.each(rows, (function(row, callback2) {
                    users[row.port] = {
                      "Id": row.port,
                      "PosX": row.posX,
                      "PosY": row.posY
                    };
                    return callback2();
                  }), function(err2) {
                    console.log(users);
                    return callback(null, users);
                  });
                },
                second: function(callback) {
                  var objects;
                  objects = [];
                  return connection.query('SELECT * FROM `object_map` WHERE `admin`="' + users_sockets[sock.remotePort] + '" AND `id_map`=1;', function(err, rows) {
                    console.log("OBJS:" + rows);
                    console.log(err);
                    return async.each(rows, (function(row, callback2) {
                      objects.push({
                        Id: row.id_obj,
                        PosX: row.posX,
                        PosY: row.posY
                      });
                      return callback2();
                    }), function(err2) {
                      console.log(objects);
                      return callback(null, objects);
                    });
                  });
                }
              }, function(err, results) {
                var ret;
                ret = JSON.stringify({
                  Action: "sendMap",
                  Map: map,
                  X: user.getPosX(),
                  Y: user.getPosY(),
                  Id: sock.remotePort,
                  Users: results.one,
                  Objects: results.second
                });
                return sock.write(ret);
              });
            });
          };
          sendPosition = function(client_id) {
            return connection.query('SELECT `posX`, `posY` FROM `users` WHERE `port`=' + client_id + ';', function(err, rows) {
              if (!err) {
                sock.write(JSON.stringify({
                  Action: "position",
                  Id: client_id,
                  PosX: rows[0].posX,
                  PosY: rows[0].posY
                }));
              }
            });
          };
          newConnectionWarningUser = function(ou) {
            var msg;
            sys.puts("Enviando nueva conexión a clientes");
            msg = ou;
            msg["Action"] = "new";
            msg = JSON.stringify(msg);
            i = 0;
            len = sockets.length;
            while (i < len) {
              if (sockets[i] !== sock) {
                if (sockets[i]) {
                  sockets[i].write(msg);
                }
              }
              i++;
            }
          };
          sendFightToAnotherClient = function(emisor_id, receiver_id) {
            var retOthers;
            retOthers = JSON.stringify({
              Action: "hide",
              Ids: [emisor_id, receiver_id]
            });
            return connection.query("UPDATE `users` SET `rollDice`=" + randomValue(1, 6) + "; WHERE `port`=" + emisor_id + ";", function(err, res) {
              var ret;
              i = 0;
              len = sockets.length;
              while (i < len) {
                if (sockets[i].remotePort === receiver_id) {
                  ret = JSON.stringify({
                    Action: "fight",
                    Id_enemy: emisor_id
                  });
                  connection.query("UPDATE `users` SET `rollDice`=" + randomValue(1, 6) + "; WHERE `port`=" + receiver_id + ";", function(err, res) {
                    return sockets[i].write(ret);
                  });
                } else {
                  if (sockets[i].remotePort !== emisor_id) {
                    sockets[i].write(retOthers);
                  }
                }
                i++;
              }
            });
          };
          randomValue = function(min, max) {
            var rand;
            rand = min + Math.floor(Math.random() * max);
            return rand;
          };
          sock.on("data", function(data) {
            var Exception, d, idx, insOrUpd, posX, posY, ret;
            sys.puts("RECIBO: " + data);
            if (data !== "\n") {
              data = data.toString("utf8");
              d = data;
              try {
                d = JSON.parse(data);
              } catch (_error) {
                Exception = _error;
                sys.puts("Error parseo");
              }
              switch (d.Action) {
                case "initWName":
                  insOrUpd = 1;
                  posX = 320;
                  posY = 320;
                  async.series({
                    zero: function(callback) {
                      return connection.query('SELECT `port`, `posX`, `posY` FROM `users` WHERE `username`="' + d.Name + '"', function(err, res) {
                        if (res.length === 0 || err) {
                          insOrUpd = 0;
                        } else {
                          posX = res[0].posX;
                          posY = res[0].posY;
                        }
                        return callback(null, "zero");
                      });
                    },
                    one: function(callback) {
                      if (insOrUpd === 0) {
                        connection.query("INSERT INTO `users` (`port`, `username`) VALUES ('" + sock.remotePort + "', '" + d.Name + "');", function(err, res) {
                          return console.log("ERR: " + err);
                        });
                        return callback(null, new ObjectUser(sock.remotePort, posX, posY));
                      } else {
                        connection.query("UPDATE `users` SET `port`=" + sock.remotePort + ", `isAlive`=1 WHERE `username`='" + d.Name + "';", function(err, res) {
                          return console.log("ERR: " + err);
                        });
                        return callback(null, new ObjectUser(sock.remotePort, posX, posY));
                      }
                    }
                  }, function(err, results) {
                    if (!err) {
                      users_sockets[sock.remotePort] = d.Name;
                      sys.puts("Connected: " + sock.remoteAddress + ":" + sock.remotePort);
                      sockets.push(sock);
                      sendMap(0, results.one);
                      return newConnectionWarningUser(results.one);
                    }
                  });
                  break;
                case "move":
                  connection.query("UPDATE `users` SET `port`=" + sock.remotePort + ",`posX`=" + d.Pos.X + ",`posY`=" + d.Pos.Y + " WHERE `port`=" + sock.remotePort + ";", function(err) {});
                  break;
                case "position":
                  sendPosition(sock.remotePort);
                  return;
                case "fight":
                  sendFightToAnotherClient(sock.remotePort, d.Id_enemy);
                  return;
                case "finishBattle":
                  sendDiePlayerAndWinnerToShow(sock.remotePort, d.Id_enemy);
                  return;
                case "getObj":
                  data = undefined;
                  console.log("USUARIO: " + JSON.stringify(users_sockets[sock.remotePort]));
                  connection.query("UPDATE `object_map` SET `admin`='" + users_sockets[sock.remotePort] + "' WHERE `id`=" + d.Id_obj + " AND `id_map`=1;", function(err) {
                    if (!err) {
                      console.log("Obtenido objeto");
                      sock.write(JSON.stringify({
                        "Action": "getObjFromServer",
                        "Id": d.Id_obj,
                        "OK": 1
                      }));
                      d["Action"] = "remObj";
                      delete d.Id_user;
                      data = JSON.stringify(d);
                      return maps[0].removeKeyObject(d.Id_obj);
                    } else {
                      console.log("Error obtener objeto");
                      sock.write(JSON.stringify({
                        "Action": "getObjFromServer",
                        "Id": d.Id_obj,
                        "OK": 0
                      }));
                    }
                  });
                  break;
                case "freeObj":
                  connection.query("UPDATE `object_map` SET `posX`=" + d.Obj.PosX + ",`posY`=" + d.Obj.PosY + ",`admin`=NULL WHERE `id`=" + d.Obj.Id_obj + " AND `id_map`=1;", function(err) {
                    var obj;
                    if (!err) {
                      obj = maps[0].addKeyObject(d.Obj.Id_obj, d.Obj.PosX, d.Obj.PosY);
                      data = JSON.stringify({
                        "Action": "addObj",
                        "Obj": obj
                      });
                      return sock.write(JSON.stringify({
                        "Action": "liberateObj",
                        "Id": d.Obj.Id_obj,
                        "OK": 1
                      }));
                    } else {
                      data = undefined;
                      return sock.write(JSON.stringify({
                        "Action": "liberateObj",
                        "Id": d.Obj.Id_obj,
                        "OK": 0
                      }));
                    }
                  });
                  break;
                case "exit":
                  sys.puts("exit command received: " + sock.remoteAddress + ":" + sock.remotePort + "\n");
                  ret = JSON.stringify({
                    Action: "exit",
                    Id: sock.remotePort
                  });
                  delete users_sockets[sock.remotePort];
                  sys.puts("ACTUAL: " + sockets.length);
                  idx = sockets.indexOf(sock);
                  sys.puts("Desconectado " + idx);
                  sys.puts(sockets);
                  if (idx !== -1) {
                    sockets.splice(idx, 1);
                    sys.puts("Borrado " + idx);
                  }
                  sys.puts("ACTUAL: " + sockets.length);
                  len = sockets.length;
                  i = 0;
                  while (i < len) {
                    if (sockets[i] !== sock) {
                      if (sockets[i]) {
                        sockets[i].write(ret);
                      }
                    }
                    i++;
                  }
                  connection.query("UPDATE `users` SET `isAlive`=0 WHERE `port`=" + sock.remotePort + ";", function(err) {});
                  return;
              }
              if (data !== undefined) {
                len = sockets.length;
                i = 0;
                while (i < len) {
                  if (sockets[i] !== sock) {
                    if (sockets[i]) {
                      sockets[i].write(data);
                    }
                  }
                  i++;
                }
              }
            }
          });
          sock.on("end", function() {
            sys.puts("Disconnected end: " + sock.remotePort + "\n");
          });
          sock.on("error", function(exc) {});
          sendDiePlayerAndWinnerToShow = function(emisor_id, receiver_id) {
            var emisor_roll, receiver_roll, ret, valueC, valueE, winner;
            ret = undefined;
            valueC = undefined;
            valueE = undefined;
            winner = undefined;
            winner = -1;
            valueC = -1;
            valueE = -1;
            emisor_roll = undefined;
            receiver_roll = undefined;
            return connection.query('SELECT `port`, `rollDice` FROM `users` WHERE `port`="' + emisor_id + '" or `port`=' + receiver_id + ';', function(err, res) {
              i = 0;
              len = res.length;
              while (i < len) {
                if (res[i].port === emisor_id) {
                  emisor_roll = res[i].rollDice;
                } else if (res[i].port === receiver_id) {
                  receiver_roll = res[i].rollDice;
                }
                i++;
              }
              if (!emisor_roll) {
                winner = receiver_id;
                valueC = receiver_roll;
              } else if (!receiver_roll) {
                winner = emisor_id;
                valueE = emisor_roll;
              } else if (emisor_roll > receiver_roll) {
                winner = emisor_id;
                valueE = emisor_roll;
                valueC = receiver_roll;
              } else if (receiver_roll > emisor_roll) {
                winner = receiver_id;
                valueE = emisor_roll;
                valueC = receiver_roll;
              }
              ret = JSON.stringify({
                Action: "finishBattle",
                ValueClient: valueC,
                ValueEnemy: valueE,
                Winner: winner
              });
              sock.write(ret);
            });
          };
        });
        svraddr = "127.0.0.1";
        svrport = 8089;
        svr.listen(svrport, svraddr);
        sys.puts("Server Created at " + svraddr + ":" + svrport + "\n");
      });
    });
  });

}).call(this);
