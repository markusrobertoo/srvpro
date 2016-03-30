// Generated by CoffeeScript 1.10.0
(function() {
  var Graveyard, Room, _, bunyan, crypto, date, debug, dialogues, execFile, fs, http, http_server, https, https_server, list, log, moment, net, options, os, path, pg, redis, redisdb, request, requestListener, roomlist, settings, tips, tribute, url, users_cache, wait_room_start, ygopro, zlib;

  net = require('net');

  http = require('http');

  url = require('url');

  path = require('path');

  fs = require('fs');

  os = require('os');

  crypto = require('crypto');

  execFile = require('child_process').execFile;

  _ = require('underscore');

  _.str = require('underscore.string');

  _.mixin(_.str.exports());

  request = require('request');

  bunyan = require('bunyan');

  moment = require('moment');

  settings = require('./config.json');

  settings.BANNED_user = [];

  settings.BANNED_IP = [];

  settings.version = parseInt(fs.readFileSync('ygopro/gframe/game.cpp', 'utf8').match(/PRO_VERSION = ([x\d]+)/)[1], '16');

  settings.lflist = (function() {
    var k, len, ref, results;
    ref = fs.readFileSync('ygopro/lflist.conf', 'utf8').match(/!.*/g);
    results = [];
    for (k = 0, len = ref.length; k < len; k++) {
      list = ref[k];
      date = list.match(/!([\d\.]+)/);
      if (!date) {
        continue;
      }
      results.push({
        date: moment(list.match(/!([\d\.]+)/)[1], 'YYYY.MM.DD'),
        tcg: list.indexOf('TCG') !== -1
      });
    }
    return results;
  })();

  if (settings.modules.enable_cloud_replay) {
    redis = require('redis');
    zlib = require('zlib');
    redisdb = redis.createClient({
      host: "127.0.0.1",
      port: settings.modules.redis_port
    });
  }

  if (settings.modules.enable_windbot) {
    settings.modules.windbots = require('./config.bot.json').windbots;
  }

  ygopro = require('./ygopro.js');

  Room = require('./room.js');

  if (settings.modules.enable_websocket_roomlist) {
    roomlist = require('./roomlist.js');
  }

  users_cache = {};

  debug = false;

  log = null;

  if (process.argv[2] === '--debug') {
    settings.port++;
    if (settings.modules.http) {
      settings.modules.http.port++;
    }
    log = bunyan.createLogger({
      name: "mycard-debug"
    });
  } else {
    log = bunyan.createLogger({
      name: "mycard"
    });
  }

  Graveyard = [];

  tribute = function(socket) {
    setTimeout((function(socket) {
      Graveyard.push(socket);
    })(socket), 3000);
  };

  setInterval(function() {
    var fuck, i, j, k, l, len, len1, ref, you;
    for (i = k = 0, len = Graveyard.length; k < len; i = ++k) {
      fuck = Graveyard[i];
      if (Graveyard[i]) {
        Graveyard[i].destroy();
      }
      ref = Graveyard[i];
      for (j = l = 0, len1 = ref.length; l < len1; j = ++l) {
        you = ref[j];
        Graveyard[i][j] = null;
      }
      Graveyard[i] = null;
    }
    Graveyard = [];
  }, 3000);

  net.createServer(function(client) {
    var ctos_buffer, ctos_message_length, ctos_proto, server, stoc_buffer, stoc_message_length, stoc_proto;
    server = new net.Socket();
    client.server = server;
    client.setTimeout(300000);
    client.on('close', function(had_error) {
      tribute(client);
      if (!client.closed) {
        client.closed = true;
        if (client.room) {
          client.room.disconnect(client);
        }
      }
      server.end();
    });
    client.on('error', function(error) {
      tribute(client);
      if (!client.closed) {
        client.closed = error;
        if (client.room) {
          client.room.disconnect(client, error);
        }
      }
      server.end();
    });
    client.on('timeout', function() {
      server.end();
    });
    server.on('close', function(had_error) {
      tribute(server);
      client.room.disconnector = 'server';
      if (!server.closed) {
        server.closed = true;
      }
      if (!client.closed) {
        ygopro.stoc_send_chat(client, "服务器关闭了连接", 11);
        client.end();
      }
    });
    server.on('error', function(error) {
      tribute(server);
      client.room.disconnector = 'server';
      server.closed = error;
      if (!client.closed) {
        ygopro.stoc_send_chat(client, "服务器错误: " + error, 11);
        client.end();
      }
    });
    if (settings.modules.enable_cloud_replay) {
      client.open_cloud_replay = function(err, replay) {
        var buffer;
        if (err || !replay) {
          ygopro.stoc_send_chat(client, "没有找到录像", 11);
          ygopro.stoc_send(client, 'ERROR_MSG', {
            msg: 1,
            code: 2
          });
          client.end();
          return;
        }
        redisdb.expire("replay:" + replay.replay_id, 60 * 60 * 48);
        buffer = new Buffer(replay.replay_buffer, 'binary');
        zlib.unzip(buffer, (function(_this) {
          return function(err, replay_buffer) {
            ygopro.stoc_send_chat(client, "正在观看云录像：R#" + replay.replay_id + " " + replay.player_names + " " + replay.date_time, 14);
            client.write(replay_buffer);
            client.end();
          };
        })(this));
      };
    }
    ctos_buffer = new Buffer(0);
    ctos_message_length = 0;
    ctos_proto = 0;
    client.pre_establish_buffers = new Array();
    client.on('data', function(data) {
      var b, buffer, cancel, datas, k, l, len, len1, looplimit, struct;
      if (client.is_post_watcher) {
        client.room.watcher.write(data);
      } else {
        ctos_buffer = Buffer.concat([ctos_buffer, data], ctos_buffer.length + data.length);
        datas = [];
        looplimit = 0;
        while (true) {
          if (ctos_message_length === 0) {
            if (ctos_buffer.length >= 2) {
              ctos_message_length = ctos_buffer.readUInt16LE(0);
            } else {
              break;
            }
          } else if (ctos_proto === 0) {
            if (ctos_buffer.length >= 3) {
              ctos_proto = ctos_buffer.readUInt8(2);
            } else {
              break;
            }
          } else {
            if (ctos_buffer.length >= 2 + ctos_message_length) {
              cancel = false;
              if (ygopro.ctos_follows[ctos_proto]) {
                b = ctos_buffer.slice(3, ctos_message_length - 1 + 3);
                if (struct = ygopro.structs[ygopro.proto_structs.CTOS[ygopro.constants.CTOS[ctos_proto]]]) {
                  struct._setBuff(b);
                  if (ygopro.ctos_follows[ctos_proto].synchronous) {
                    cancel = ygopro.ctos_follows[ctos_proto].callback(b, _.clone(struct.fields), client, server);
                  } else {
                    ygopro.ctos_follows[ctos_proto].callback(b, _.clone(struct.fields), client, server);
                  }
                } else {
                  ygopro.ctos_follows[ctos_proto].callback(b, null, client, server);
                }
              }
              if (!cancel) {
                datas.push(ctos_buffer.slice(0, 2 + ctos_message_length));
              }
              ctos_buffer = ctos_buffer.slice(2 + ctos_message_length);
              ctos_message_length = 0;
              ctos_proto = 0;
            } else {
              break;
            }
          }
          looplimit++;
          if (looplimit > 800) {
            log.info("error ctos", client.name);
            server.end();
            break;
          }
        }
        if (client.established) {
          for (k = 0, len = datas.length; k < len; k++) {
            buffer = datas[k];
            server.write(buffer);
          }
        } else {
          for (l = 0, len1 = datas.length; l < len1; l++) {
            buffer = datas[l];
            client.pre_establish_buffers.push(buffer);
          }
        }
      }
    });
    stoc_buffer = new Buffer(0);
    stoc_message_length = 0;
    stoc_proto = 0;
    server.on('data', function(data) {
      var b, looplimit, stanzas, struct;
      stoc_buffer = Buffer.concat([stoc_buffer, data], stoc_buffer.length + data.length);
      client.write(data);
      looplimit = 0;
      while (true) {
        if (stoc_message_length === 0) {
          if (stoc_buffer.length >= 2) {
            stoc_message_length = stoc_buffer.readUInt16LE(0);
          } else {
            break;
          }
        } else if (stoc_proto === 0) {
          if (stoc_buffer.length >= 3) {
            stoc_proto = stoc_buffer.readUInt8(2);
          } else {
            break;
          }
        } else {
          if (stoc_buffer.length >= 2 + stoc_message_length) {
            stanzas = stoc_proto;
            if (ygopro.stoc_follows[stoc_proto]) {
              b = stoc_buffer.slice(3, stoc_message_length - 1 + 3);
              if (struct = ygopro.structs[ygopro.proto_structs.STOC[ygopro.constants.STOC[stoc_proto]]]) {
                struct._setBuff(b);
                ygopro.stoc_follows[stoc_proto].callback(b, _.clone(struct.fields), client, server);
              } else {
                ygopro.stoc_follows[stoc_proto].callback(b, null, client, server);
              }
            }
            stoc_buffer = stoc_buffer.slice(2 + stoc_message_length);
            stoc_message_length = 0;
            stoc_proto = 0;
          } else {
            break;
          }
        }
        looplimit++;
        if (looplimit > 800) {
          log.info("error stoc", client.name);
          server.end();
          break;
        }
      }
    });
  }).listen(settings.port, function() {
    log.info("server started", settings.port);
  });

  ygopro.ctos_follow('PLAYER_INFO', true, function(buffer, info, client, server) {
    var name, struct;
    name = info.name.split("$")[0];
    struct = ygopro.structs["CTOS_PlayerInfo"];
    struct._setBuff(buffer);
    struct.set("name", name);
    buffer = struct.buffer;
    client.name = name;
    return false;
  });

  ygopro.ctos_follow('JOIN_GAME', false, function(buffer, info, client, server) {
    var check, decrypted_buffer, finish, i, id, k, l, len, len1, name, ref, ref1, replay_id, room, secret, windbot;
    if (settings.modules.stop) {
      ygopro.stoc_send_chat(client, settings.modules.stop, 11);
      ygopro.stoc_send(client, 'ERROR_MSG', {
        msg: 1,
        code: 2
      });
      client.end();
    } else if (info.pass.toUpperCase() === "R" && settings.modules.enable_cloud_replay) {
      ygopro.stoc_send_chat(client, "以下是您近期的云录像，密码处输入 R#录像编号 即可观看", 14);
      redisdb.lrange(client.remoteAddress + ":replays", 0, 2, (function(_this) {
        return function(err, result) {
          _.each(result, function(replay_id, id) {
            redisdb.hgetall("replay:" + replay_id, function(err, replay) {
              ygopro.stoc_send_chat(client, "<" + (id - 0 + 1) + "> R#" + replay_id + " " + replay.player_names + " " + replay.date_time, 14);
            });
          });
        };
      })(this));
      setTimeout(((function(_this) {
        return function() {
          ygopro.stoc_send(client, 'ERROR_MSG', {
            msg: 1,
            code: 2
          });
          return client.end();
        };
      })(this)), 500);
    } else if (info.pass.slice(0, 2).toUpperCase() === "R#" && settings.modules.enable_cloud_replay) {
      replay_id = info.pass.split("#")[1];
      if (replay_id > 0 && replay_id <= 3) {
        redisdb.lindex(client.remoteAddress + ":replays", replay_id - 1, (function(_this) {
          return function(err, replay_id) {
            redisdb.hgetall("replay:" + replay_id, client.open_cloud_replay);
          };
        })(this));
      } else if (replay_id) {
        redisdb.hgetall("replay:" + replay_id, client.open_cloud_replay);
      } else {
        ygopro.stoc_send_chat(client, "没有找到录像", 11);
        ygopro.stoc_send(client, 'ERROR_MSG', {
          msg: 1,
          code: 2
        });
        client.end();
      }
    } else if (info.version !== settings.version) {
      ygopro.stoc_send_chat(client, settings.modules.update, 11);
      ygopro.stoc_send(client, 'ERROR_MSG', {
        msg: 4,
        code: settings.version
      });
      client.end();
    } else if (!info.pass.length && !settings.modules.enable_random_duel) {
      ygopro.stoc_send_chat(client, "房间名为空，请填写主机密码", 11);
      ygopro.stoc_send(client, 'ERROR_MSG', {
        msg: 1,
        code: 2
      });
      client.end();
    } else if (settings.modules.enable_windbot && info.pass.slice(0, 2) === 'AI') {
      if (info.pass.length > 3 && info.pass.slice(0, 3) === 'AI#' || info.pass.slice(0, 3) === 'AI_') {
        name = info.pass.slice(3);
        windbot = _.sample(_.filter(settings.modules.windbots, function(w) {
          return w.name === name || w.deck === name;
        }));
        if (!windbot) {
          ygopro.stoc_send_chat(client, '主机密码不正确 (Invalid Windbot Name)', 11);
          ygopro.stoc_send(client, 'ERROR_MSG', {
            msg: 1,
            code: 2
          });
          client.end();
          return;
        }
      } else {
        windbot = _.sample(settings.modules.windbots);
      }
      room = Room.find_or_create_by_name('AI#' + Math.floor(Math.random() * 100000));
      room.windbot = windbot;
      room["private"] = true;
      client.room = room;
      client.room.connect(client);
    } else if (info.pass.length && settings.modules.mycard_auth) {
      ygopro.stoc_send_chat(client, '正在读取用户信息...', 11);
      if (info.pass.length <= 8) {
        ygopro.stoc_send_chat(client, '主机密码不正确 (Invalid Length)', 11);
        ygopro.stoc_send(client, 'ERROR_MSG', {
          msg: 1,
          code: 2
        });
        client.end();
        return;
      }
      buffer = new Buffer(info.pass.slice(0, 8), 'base64');
      if (buffer.length !== 6) {
        ygopro.stoc_send_chat(client, '主机密码不正确 (Invalid Payload Length)', 11);
        ygopro.stoc_send(client, 'ERROR_MSG', {
          msg: 1,
          code: 2
        });
        client.end();
        return;
      }
      check = function(buf) {
        var checksum, i, k, ref;
        checksum = 0;
        for (i = k = 0, ref = buf.length; 0 <= ref ? k < ref : k > ref; i = 0 <= ref ? ++k : --k) {
          checksum += buf.readUInt8(i);
        }
        return (checksum & 0xFF) === 0;
      };
      finish = function(buffer) {
        var action, opt1, opt2, opt3, options;
        action = buffer.readUInt8(1) >> 4;
        if (buffer !== decrypted_buffer && (action === 1 || action === 2 || action === 4)) {
          ygopro.stoc_send_chat(client, '主机密码不正确 (Unauthorized)', 11);
          ygopro.stoc_send(client, 'ERROR_MSG', {
            msg: 1,
            code: 2
          });
          client.end();
          return;
        }
        switch (action) {
          case 1:
          case 2:
            name = crypto.createHash('md5').update(info.pass + client.name).digest('base64').slice(0, 10).replace('+', '-').replace('/', '_');
            if (Room.find_by_name(name)) {
              ygopro.stoc_send_chat(client, '主机密码不正确 (Already Existed)', 11);
              ygopro.stoc_send(client, 'ERROR_MSG', {
                msg: 1,
                code: 2
              });
              client.end();
              return;
            }
            opt1 = buffer.readUInt8(2);
            opt2 = buffer.readUInt16LE(3);
            opt3 = buffer.readUInt8(5);
            options = {
              lflist: 0,
              time_limit: 180,
              rule: (opt1 >> 5) & 3,
              mode: (opt1 >> 3) & 3,
              enable_priority: !!((opt1 >> 2) & 1),
              no_check_deck: !!((opt1 >> 1) & 1),
              no_shuffle_deck: !!(opt1 & 1),
              start_lp: opt2,
              start_hand: opt3 >> 4,
              draw_count: opt3 & 0xF
            };
            options.lflist = _.findIndex(settings.lflist, function(list) {
              return ((options.rule === 1) === list.tcg) && list.date.isBefore();
            });
            room = new Room(name, options);
            room.title = info.pass.slice(8).replace(String.fromCharCode(0xFEFF), ' ');
            room["private"] = action === 2;
            break;
          case 3:
            name = info.pass.slice(8);
            room = Room.find_by_name(name);
            if (!room) {
              ygopro.stoc_send_chat(client, '主机密码不正确 (Not Found)', 11);
              ygopro.stoc_send(client, 'ERROR_MSG', {
                msg: 1,
                code: 2
              });
              client.end();
              return;
            }
            break;
          case 4:
            room = Room.find_or_create_by_name('M#' + info.pass.slice(8));
            room["private"] = true;
            break;
          default:
            ygopro.stoc_send_chat(client, '主机密码不正确 (Invalid Action)', 11);
            ygopro.stoc_send(client, 'ERROR_MSG', {
              msg: 1,
              code: 2
            });
            client.end();
            return;
        }
        client.room = room;
        return client.room.connect(client);
      };
      if (id = users_cache[client.name]) {
        secret = id % 65535 + 1;
        decrypted_buffer = new Buffer(6);
        ref = [0, 2, 4];
        for (k = 0, len = ref.length; k < len; k++) {
          i = ref[k];
          decrypted_buffer.writeUInt16LE(buffer.readUInt16LE(i) ^ secret, i);
        }
        if (check(decrypted_buffer)) {
          return finish(decrypted_buffer);
        }
      }
      request({
        baseUrl: settings.modules.mycard_auth,
        url: '/users/' + encodeURIComponent(client.name) + '.json',
        qs: {
          api_key: 'dc7298a754828b3d26b709f035a0eeceb43e73cbd8c4fa8dec18951f8a95d2bc',
          api_username: client.name,
          skip_track_visit: true
        },
        json: true
      }, function(error, response, body) {
        var l, len1, ref1;
        if (body && body.user) {
          secret = body.user.id % 65535 + 1;
          decrypted_buffer = new Buffer(6);
          ref1 = [0, 2, 4];
          for (l = 0, len1 = ref1.length; l < len1; l++) {
            i = ref1[l];
            decrypted_buffer.writeUInt16LE(buffer.readUInt16LE(i) ^ secret, i);
          }
          if (check(decrypted_buffer)) {
            buffer = decrypted_buffer;
          }
        }
        if (!check(buffer)) {
          ygopro.stoc_send_chat(client, '主机密码不正确 (Checksum Failed)', 11);
          ygopro.stoc_send(client, 'ERROR_MSG', {
            msg: 1,
            code: 2
          });
          client.end();
          return;
        }
        users_cache[client.name] = body.user.id;
        return finish(buffer);
      });
    } else if (info.pass.length && !Room.validate(info.pass)) {
      ygopro.stoc_send_chat(client, "房间密码不正确", 11);
      ygopro.stoc_send(client, 'ERROR_MSG', {
        msg: 1,
        code: 2
      });
      client.end();
    } else if (client.name === '[INCORRECT]') {
      ygopro.stoc_send(client, 'ERROR_MSG', {
        msg: 1,
        code: 2
      });
      client.end();
    } else if (_.indexOf(settings.BANNED_user, client.name) > -1) {
      settings.BANNED_IP.push(client.remoteAddress);
      log.info("BANNED USER LOGIN", client.name, client.remoteAddress);
      ygopro.stoc_send_chat(client, "您的账号已被封禁", 11);
      ygopro.stoc_send(client, 'ERROR_MSG', {
        msg: 1,
        code: 2
      });
      client.end();
    } else if (_.indexOf(settings.BANNED_IP, client.remoteAddress) > -1) {
      log.info("BANNED IP LOGIN", client.name, client.remoteAddress);
      ygopro.stoc_send_chat(client, "您的账号已被封禁", 11);
      ygopro.stoc_send(client, 'ERROR_MSG', {
        msg: 1,
        code: 2
      });
      client.end();
    } else {
      room = Room.find_or_create_by_name(info.pass, client.remoteAddress);
      if (!room) {
        ygopro.stoc_send_chat(client, "服务器已经爆满，请稍候再试", 11);
        ygopro.stoc_send(client, 'ERROR_MSG', {
          msg: 1,
          code: 2
        });
        client.end();
      } else if (room.error) {
        ygopro.stoc_send_chat(client, room.error, 11);
        ygopro.stoc_send(client, 'ERROR_MSG', {
          msg: 1,
          code: 2
        });
        client.end();
      } else if (room.started) {
        if (settings.modules.enable_halfway_watch) {
          client.room = room;
          client.is_post_watcher = true;
          ygopro.stoc_send_chat_to_room(client.room, client.name + " 加入了观战");
          client.room.watchers.push(client);
          ygopro.stoc_send_chat(client, "观战中", 14);
          ref1 = client.room.watcher_buffers;
          for (l = 0, len1 = ref1.length; l < len1; l++) {
            buffer = ref1[l];
            client.write(buffer);
          }
        } else {
          ygopro.stoc_send_chat(client, "决斗已开始，不允许观战", 11);
          ygopro.stoc_send(client, 'ERROR_MSG', {
            msg: 1,
            code: 2
          });
          client.end();
        }
      } else {
        client.room = room;
        client.room.connect(client);
      }
    }
  });

  ygopro.stoc_follow('JOIN_GAME', false, function(buffer, info, client, server) {
    var watcher;
    if (!client.room) {
      return;
    }
    if (settings.modules.welcome) {
      ygopro.stoc_send_chat(client, settings.modules.welcome);
    }
    if (client.room.welcome) {
      ygopro.stoc_send_chat(client, client.room.welcome, 14);
    }
    if (settings.modules.enable_halfway_watch && !client.room.watcher) {
      client.room.watcher = watcher = net.connect(client.room.port, function() {
        ygopro.ctos_send(watcher, 'PLAYER_INFO', {
          name: "the Big Brother"
        });
        ygopro.ctos_send(watcher, 'JOIN_GAME', {
          version: settings.version,
          gameid: 2577,
          some_unknown_mysterious_fucking_thing: 0,
          pass: ""
        });
        ygopro.ctos_send(watcher, 'HS_TOOBSERVER');
      });
      watcher.on('data', function(data) {
        var k, len, ref, w;
        if (!client.room) {
          return;
        }
        client.room.watcher_buffers.push(data);
        ref = client.room.watchers;
        for (k = 0, len = ref.length; k < len; k++) {
          w = ref[k];
          if (w) {
            w.write(data);
          }
        }
      });
      watcher.on('error', function(error) {});
    }
  });

  if (settings.modules.dialogues) {
    dialogues = {};
    request({
      url: settings.modules.dialogues,
      json: true
    }, function(error, response, body) {
      if (_.isString(body)) {
        log.warn("dialogues bad json", body);
      } else if (error || !body) {
        log.warn('dialogues error', error, response);
      } else {
        dialogues = body;
      }
    });
  }

  ygopro.stoc_follow('GAME_MSG', false, function(buffer, info, client, server) {
    var card, k, len, line, msg, playertype, pos, ref, ref1, ref2, val;
    msg = buffer.readInt8(0);
    if (msg >= 10 && msg < 30) {
      client.room.waiting_for_player = client;
      client.room.last_active_time = moment();
    }
    if (ygopro.constants.MSG[msg] === 'START') {
      playertype = buffer.readUInt8(1);
      client.is_first = !(playertype & 0xf);
      client.lp = client.room.hostinfo.start_lp;
    }

    /*
    if ygopro.constants.MSG[msg] == 'WIN' and _.startsWith(client.room.name, 'M#') and client.is_host
      pos = buffer.readUInt8(1)
      pos = 1 - pos unless client.is_first or pos == 2
      reason = buffer.readUInt8(2)
      #log.info {winner: pos, reason: reason}
      client.room.duels.push {winner: pos, reason: reason}
     */
    if (ygopro.constants.MSG[msg] === 'DAMAGE' && client.is_host) {
      pos = buffer.readUInt8(1);
      if (!client.is_first) {
        pos = 1 - pos;
      }
      val = buffer.readInt32LE(2);
      client.room.dueling_players[pos].lp -= val;
      if ((0 < (ref = client.room.dueling_players[pos].lp) && ref <= 100)) {
        ygopro.stoc_send_chat_to_room(client.room, "你的生命已经如风中残烛了！", 15);
      }
    }
    if (ygopro.constants.MSG[msg] === 'RECOVER' && client.is_host) {
      pos = buffer.readUInt8(1);
      if (!client.is_first) {
        pos = 1 - pos;
      }
      val = buffer.readInt32LE(2);
      client.room.dueling_players[pos].lp += val;
    }
    if (ygopro.constants.MSG[msg] === 'LPUPDATE' && client.is_host) {
      pos = buffer.readUInt8(1);
      if (!client.is_first) {
        pos = 1 - pos;
      }
      val = buffer.readInt32LE(2);
      client.room.dueling_players[pos].lp = val;
    }
    if (ygopro.constants.MSG[msg] === 'PAY_LPCOST' && client.is_host) {
      pos = buffer.readUInt8(1);
      if (!client.is_first) {
        pos = 1 - pos;
      }
      val = buffer.readInt32LE(2);
      client.room.dueling_players[pos].lp -= val;
      if ((0 < (ref1 = client.room.dueling_players[pos].lp) && ref1 <= 100)) {
        ygopro.stoc_send_chat_to_room(client.room, "背水一战！", 15);
      }
    }
    if (settings.modules.dialogues) {
      if (ygopro.constants.MSG[msg] === 'SUMMONING' || ygopro.constants.MSG[msg] === 'SPSUMMONING') {
        card = buffer.readUInt32LE(1);
        if (dialogues[card]) {
          ref2 = _.lines(dialogues[card][Math.floor(Math.random() * dialogues[card].length)]);
          for (k = 0, len = ref2.length; k < len; k++) {
            line = ref2[k];
            ygopro.stoc_send_chat(client, line, 15);
          }
        }
      }
    }
  });

  ygopro.ctos_follow('HS_KICK', true, function(buffer, info, client, server) {
    var k, len, player, ref;
    if (!client.room) {
      return;
    }
    ref = client.room.players;
    for (k = 0, len = ref.length; k < len; k++) {
      player = ref[k];
      if (player && player.pos === info.pos && player !== client) {
        ygopro.stoc_send_chat_to_room(client.room, player.name + " 被请出了房间", 11);
      }
    }
    return false;
  });

  ygopro.stoc_follow('TYPE_CHANGE', false, function(buffer, info, client, server) {
    var is_host, selftype;
    selftype = info.type & 0xf;
    is_host = ((info.type >> 4) & 0xf) !== 0;
    client.is_host = is_host;
    client.pos = selftype;
  });

  ygopro.stoc_follow('HS_PLAYER_CHANGE', false, function(buffer, info, client, server) {
    var is_ready, k, len, player, pos, ref;
    if (!(client.room && client.room.max_player && client.is_host)) {
      return;
    }
    pos = info.status >> 4;
    is_ready = (info.status & 0xf) === 9;
    if (pos < client.room.max_player) {
      client.room.ready_player_count_without_host = 0;
      ref = client.room.players;
      for (k = 0, len = ref.length; k < len; k++) {
        player = ref[k];
        if (player.pos === pos) {
          player.is_ready = is_ready;
        }
        if (!player.is_host) {
          client.room.ready_player_count_without_host += player.is_ready;
        }
      }
      if (client.room.ready_player_count_without_host >= client.room.max_player - 1) {
        setTimeout((function() {
          wait_room_start(client.room, 20);
        }), 1000);
      }
    }
  });

  wait_room_start = function(room, time) {
    var k, len, player, ref;
    if (!(!room || room.started || room.ready_player_count_without_host < room.max_player - 1)) {
      time -= 1;
      if (time) {
        if (!(time % 5)) {
          ygopro.stoc_send_chat_to_room(room, "" + (time <= 9 ? ' ' : '') + time + "秒后房主若不开始游戏将被请出房间", time <= 9 ? 11 : 8);
        }
        setTimeout((function() {
          wait_room_start(room, time);
        }), 1000);
      } else {
        ref = room.players;
        for (k = 0, len = ref.length; k < len; k++) {
          player = ref[k];
          if (player && player.is_host) {
            Room.ban_player(player.name, player.ip, "挂房间");
            ygopro.stoc_send_chat_to_room(room, player.name + " 被系统请出了房间", 11);
            player.end();
          }
        }
      }
    }
  };

  ygopro.stoc_send_random_tip = function(client) {
    if (tips) {
      ygopro.stoc_send_chat(client, "Tip: " + tips[Math.floor(Math.random() * tips.length)]);
    }
  };

  ygopro.stoc_send_random_tip_to_room = function(room) {
    if (tips) {
      ygopro.stoc_send_chat_to_room(room, "Tip: " + tips[Math.floor(Math.random() * tips.length)]);
    }
  };

  setInterval(function() {
    var k, len, ref, room;
    ref = Room.all;
    for (k = 0, len = ref.length; k < len; k++) {
      room = ref[k];
      if (!(room && room.started)) {
        ygopro.stoc_send_random_tip_to_room(room);
      }
    }
  }, 30000);

  tips = null;

  if (settings.modules.tips) {
    request({
      url: settings.modules.tips,
      json: true
    }, function(error, response, body) {
      tips = body;
    });
  }

  if (settings.modules.mycard_auth && process.env.MYCARD_AUTH_DATABASE) {
    pg = require('pg');
    pg.connect(process.env.MYCARD_AUTH_DATABASE, function(error, client, done) {
      if (error) {
        throw error;
      }
      return client.query('SELECT username, id from users', function(error, result) {
        var k, len, ref, row;
        if (error) {
          throw error;
        }
        done();
        ref = result.rows;
        for (k = 0, len = ref.length; k < len; k++) {
          row = ref[k];
          users_cache[row.username] = row.id;
        }
        return console.log("users loaded", _.keys(users_cache).length);
      });
    });
  }

  ygopro.stoc_follow('DUEL_START', false, function(buffer, info, client, server) {
    var k, len, player, ref;
    if (!client.room) {
      return;
    }
    if (!client.room.started) {
      client.room.started = true;
      if (settings.modules.enable_websocket_roomlist && !client.room["private"]) {
        roomlist["delete"](client.room.name);
      }
      client.room.dueling_players = [];
      ref = client.room.players;
      for (k = 0, len = ref.length; k < len; k++) {
        player = ref[k];
        if (!(player.pos !== 7)) {
          continue;
        }
        client.room.dueling_players[player.pos] = player;
        client.room.player_datas.push({
          ip: player.remoteAddress,
          name: player.name
        });
        if (client.room.windbot) {
          client.room.dueling_players[1 - player.pos] = {};
        }
      }
    }
    if (settings.modules.tips) {
      ygopro.stoc_send_random_tip(client);
    }
  });

  ygopro.ctos_follow('CHAT', true, function(buffer, info, client, server) {
    var cancel;
    cancel = _.startsWith(_.trim(info.msg), "/");
    if (!(cancel || !client.room.random_type)) {
      client.room.last_active_time = moment();
    }
    switch (_.trim(info.msg)) {
      case '/ping':
        execFile('ss', ['-it', "dst " + client.remoteAddress + ":" + client.remotePort], function(error, stdout, stderr) {
          var line;
          if (error) {
            ygopro.stoc_send_chat_to_room(client.room, error);
          } else {
            line = _.lines(stdout)[2];
            if (line.indexOf('rtt') !== -1) {
              ygopro.stoc_send_chat_to_room(client.room, line);
            } else {
              ygopro.stoc_send_chat_to_room(client.room, stdout);
            }
          }
        });
        break;
      case '/help':
        ygopro.stoc_send_chat(client, "YGOSrv233 指令帮助");
        ygopro.stoc_send_chat(client, "/help 显示这个帮助信息");
        ygopro.stoc_send_chat(client, "/roomname 显示当前房间的名字");
        if (settings.modules.tips) {
          ygopro.stoc_send_chat(client, "/tip 显示一条提示");
        }
        break;
      case '/tip':
        if (settings.modules.tips) {
          ygopro.stoc_send_random_tip(client);
        }
        break;
      case '/roomname':
        if (client.room) {
          ygopro.stoc_send_chat(client, "您当前的房间名是 " + client.room.name);
        }
        break;
      case '/test':
        ygopro.stoc_send_hint_card_to_room(client.room, 2333365);
    }
    return cancel;
  });

  ygopro.ctos_follow('UPDATE_DECK', false, function(buffer, info, client, server) {
    var i, main, side;
    main = (function() {
      var k, ref, results;
      results = [];
      for (i = k = 0, ref = info.mainc; 0 <= ref ? k < ref : k > ref; i = 0 <= ref ? ++k : --k) {
        results.push(info.deckbuf[i]);
      }
      return results;
    })();
    side = (function() {
      var k, ref, ref1, results;
      results = [];
      for (i = k = ref = info.mainc, ref1 = info.mainc + info.sidec; ref <= ref1 ? k < ref1 : k > ref1; i = ref <= ref1 ? ++k : --k) {
        results.push(info.deckbuf[i]);
      }
      return results;
    })();
    client.main = main;
    client.side = side;
  });

  ygopro.ctos_follow('RESPONSE', false, function(buffer, info, client, server) {
    if (!(client.room && client.room.random_type)) {
      return;
    }
    client.room.last_active_time = moment();
  });

  ygopro.ctos_follow('HAND_RESULT', false, function(buffer, info, client, server) {
    if (!(client.room && client.room.random_type)) {
      return;
    }
    if (client.is_host) {
      client.room.waiting_for_player = client.room.waiting_for_player2;
    }
    client.room.last_active_time = moment().subtract(settings.modules.hang_timeout - 19, 's');
  });

  ygopro.ctos_follow('TP_RESULT', false, function(buffer, info, client, server) {
    if (!(client.room && client.room.random_type)) {
      return;
    }
    client.room.last_active_time = moment();
  });

  ygopro.stoc_follow('SELECT_HAND', false, function(buffer, info, client, server) {
    if (!(client.room && client.room.random_type)) {
      return;
    }
    if (client.is_host) {
      client.room.waiting_for_player = client;
    } else {
      client.room.waiting_for_player2 = client;
    }
    client.room.last_active_time = moment().subtract(settings.modules.hang_timeout - 19, 's');
  });

  ygopro.stoc_follow('SELECT_TP', false, function(buffer, info, client, server) {
    if (!(client.room && client.room.random_type)) {
      return;
    }
    client.room.waiting_for_player = client;
    client.room.last_active_time = moment();
  });

  setInterval(function() {
    var k, len, ref, room, time_passed;
    ref = Room.all;
    for (k = 0, len = ref.length; k < len; k++) {
      room = ref[k];
      if (!(room && room.started && room.random_type && room.last_active_time && room.waiting_for_player)) {
        continue;
      }
      time_passed = Math.floor((moment() - room.last_active_time) / 1000);
      if (time_passed >= settings.modules.hang_timeout) {
        room.last_active_time = moment();
        Room.ban_player(room.waiting_for_player.name, room.waiting_for_player.ip, "挂机");
        ygopro.stoc_send_chat_to_room(room, room.waiting_for_player.name + " 被系统请出了房间", 11);
        room.waiting_for_player.server.end();
      } else if (time_passed >= (settings.modules.hang_timeout - 20) && !(time_passed % 10)) {
        ygopro.stoc_send_chat_to_room(room, room.waiting_for_player.name + " 已经很久没有操作了，若继续挂机，将于" + (settings.modules.hang_timeout - time_passed) + "秒后被请出房间", 11);
      }
    }
  }, 1000);

  if (settings.modules.http) {
    requestListener = function(request, response) {
      var k, len, parseQueryString, pass_validated, player, ref, room, roomsjson, u;
      parseQueryString = true;
      u = url.parse(request.url, parseQueryString);
      pass_validated = u.query.pass === settings.modules.http.password;
      if (u.pathname === '/api/getrooms') {
        if (u.query.pass && !pass_validated) {
          response.writeHead(200);
          response.end(u.query.callback + '( {"rooms":[{"roomid":"0","roomname":"密码错误","needpass":"true"}]} );');
        } else {
          response.writeHead(200);
          roomsjson = JSON.stringify({
            rooms: (function() {
              var k, len, ref, results;
              ref = Room.all;
              results = [];
              for (k = 0, len = ref.length; k < len; k++) {
                room = ref[k];
                if (room.established) {
                  results.push({
                    pid: room.process.pid.toString(),
                    roomid: room.port.toString(),
                    roomname: pass_validated ? room.name : room.name.split('$', 2)[0],
                    needpass: (room.name.indexOf('$') !== -1).toString(),
                    users: (function() {
                      var l, len1, ref1, results1;
                      ref1 = room.players;
                      results1 = [];
                      for (l = 0, len1 = ref1.length; l < len1; l++) {
                        player = ref1[l];
                        if (player.pos != null) {
                          results1.push({
                            id: (-1).toString(),
                            name: player.name,
                            pos: player.pos
                          });
                        }
                      }
                      return results1;
                    })(),
                    istart: room.started ? 'start' : 'wait'
                  });
                }
              }
              return results;
            })()
          });
          response.end(u.query.callback + "( " + roomsjson + " );");
        }
      } else if (u.pathname === '/api/message') {
        if (!pass_validated) {
          response.writeHead(200);
          response.end(u.query.callback + "( '密码错误', 0 );");
          return;
        }
        if (u.query.shout) {
          ref = Room.all;
          for (k = 0, len = ref.length; k < len; k++) {
            room = ref[k];
            ygopro.stoc_send_chat_to_room(room, u.query.shout, 16);
          }
          response.writeHead(200);
          response.end(u.query.callback + "( 'shout ok', '" + u.query.shout + "' );");
        } else if (u.query.stop) {
          if (u.query.stop === 'false') {
            u.query.stop = false;
          }
          settings.modules.stop = u.query.stop;
          response.writeHead(200);
          response.end(u.query.callback + "( 'stop ok', '" + u.query.stop + "' );");
        } else if (u.query.welcome) {
          settings.modules.welcome = u.query.welcome;
          response.writeHead(200);
          response.end(u.query.callback + "( 'welcome ok', '" + u.query.welcome + "' );");
        } else if (u.query.ban) {
          settings.BANNED_user.push(u.query.ban);
          response.writeHead(200);
          response.end(u.query.callback + "( 'ban ok', '" + u.query.ban + "' );");
        } else {
          response.writeHead(404);
          response.end();
        }
      } else {
        response.writeHead(404);
        response.end();
      }
    };
    http_server = http.createServer(requestListener);
    http_server.listen(settings.modules.http.port);
    if (settings.modules.http.ssl.enabled) {
      https = require('https');
      options = {
        cert: fs.readFileSync(settings.modules.http.ssl.cert),
        key: fs.readFileSync(settings.modules.http.ssl.key)
      };
      https_server = https.createServer(options, requestListener);
      roomlist.init(https_server, Room);
      https_server.listen(settings.modules.http.ssl.port);
    }
  }

}).call(this);
