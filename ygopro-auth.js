// Generated by CoffeeScript 1.12.7

/*
Main script of new dashboard account system.
The account list file is stored at `./config/admin_user.json`. The users are stored at `users`.
The key is the username. The `permissions` field could be a string, using a permission set from the example, or an object, to define a specific set of permissions.
eg. An account for a judge could be as follows, to use the default permission of judges,
    "username": {
      "password": "123456",
      "enabled": true,
      "permissions": "judge"
    },
or as follows, to use a specific set of permissions.
    "username": {
      "password": "123456",
      "enabled": true,
      "permissions": {
        "get_rooms": true,
        "duel_log": true,
        "download_replay": true,
        "deck_dashboard_read": true,
        "deck_dashboard_write": true,
        "shout": true,
        "kick_user": true,
        "start_death": true
      }
    },
 */

(function() {
  var add_log, check_permission, default_data, fs, loadJSON, moment, reload, save, setting_save, users;

  fs = require('fs');

  loadJSON = require('load-json-file').sync;

  moment = require('moment');

  moment.updateLocale('zh-cn', {
    relativeTime: {
      future: '%s内',
      past: '%s前',
      s: '%d秒',
      m: '1分钟',
      mm: '%d分钟',
      h: '1小时',
      hh: '%d小时',
      d: '1天',
      dd: '%d天',
      M: '1个月',
      MM: '%d个月',
      y: '1年',
      yy: '%d年'
    }
  });

  if (!fs.existsSync('./logs')) {
    fs.mkdirSync('./logs');
  }

  add_log = function(message) {
    var mt, res, text;
    mt = moment();
    text = mt.format('YYYY-MM-DD HH:mm:ss') + " --> " + message + "\n";
    console.log(text);
    res = false;
    try {
      fs.appendFileSync("./logs/" + mt.format('YYYY-MM-DD') + ".log", text);
      res = true;
    } catch (error) {
      res = false;
    }
  };

  default_data = loadJSON('./data/default_data.json');

  setting_save = function(settings) {
    fs.writeFileSync(settings.file, JSON.stringify(settings, null, 2));
  };

  default_data = loadJSON('./data/default_data.json');

  try {
    users = loadJSON('./config/admin_user.json');
  } catch (error) {
    users = default_data.users;
    setting_save(users);
  }

  save = function() {
    setting_save(users);
  };

  reload = function() {
    var user_backup;
    user_backup = users;
    try {
      users = loadJSON('./config/admin_user.json');
    } catch (error) {
      users = user_backup;
      add_log("Invalid user data JSON");
    }
  };

  check_permission = function(user, permission_required) {
    var _permission, permission;
    _permission = user.permissions;
    permission = _permission;
    if (typeof permission !== 'object') {
      permission = users.permission_examples[_permission];
    }
    if (!permission) {
      add_log("Permision not set:" + _permission);
      return false;
    }
    return permission[permission_required];
  };

  this.auth = function(name, pass, permission_required, action) {
    var user;
    if (action == null) {
      action = 'unknown';
    }
    reload();
    user = users.users[name];
    if (!user) {
      add_log("Unknown user login. User: " + name + ", Permission needed: " + permission_required + ", Action: " + action);
      return false;
    }
    if (user.password !== pass) {
      add_log("Unauthorized user login. User: " + name + ", Permission needed: " + permission_required + ", Action: " + action);
      return false;
    }
    if (!user.enabled) {
      add_log("Disabled user login. User: " + name + ", Permission needed: " + permission_required + ", Action: " + action);
      return false;
    }
    if (!check_permission(user, permission_required)) {
      add_log("Permission denied. User: " + name + ", Permission needed: " + permission_required + ", Action: " + action);
      return false;
    }
    add_log("Operation success. User: " + name + ", Permission needed: " + permission_required + ", Action: " + action);
    return true;
  };

  this.add_user = function(name, pass, enabled, permissions) {
    reload();
    if (users.users[name]) {
      return false;
    }
    users.users[name] = {
      "password": pass,
      "enabled": enabled,
      "permissions": permissions
    };
    save();
    return true;
  };

  this.delete_user = function(name) {
    reload();
    if (!users.users[name]) {
      return false;
    }
    delete users.users[name];
    save();
    return true;
  };

  this.update_user = function(name, key, value) {
    reload();
    if (!users.users[name]) {
      return false;
    }
    users.users[name][key] = value;
    save();
    return true;
  };

}).call(this);
