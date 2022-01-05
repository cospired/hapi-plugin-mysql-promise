[![Build Status](https://travis-ci.org/cospired/hapi-plugin-mysql-promise.svg?branch=master)](https://travis-ci.org/cospired/hapi-plugin-mysql-promise)
[![npm version](https://badge.fury.io/js/%40cospired%2Fhapi-plugin-mysql-promise.svg)](https://badge.fury.io/js/%40cospired%2Fhapi-plugin-mysql-promise)
[![Maintainability](https://api.codeclimate.com/v1/badges/74c3d563aef39317b4df/maintainability)](https://codeclimate.com/github/cospired/hapi-plugin-mysql-promise/maintainability)

# hapi-plugin-mysql-promise

> hapi plugin for MySQL

based on [hapi-plugin-mysql](https://github.com/Salesflare/hapi-plugin-mysql) using [mysql2](https://github.com/sidorares/node-mysql2) and promises. As a side effect, this also supports JSON fields.

## What

Attaches a MySQL connection from a pool to every request. We are using `mysql2/promise` here to provide promisified version of the mysql connection.

## How

Via `request.app.db`.
You can also manually get a connection from the server via `server.getDb(function (err, connection) {})`.

```javascript
server.register({
    register: require('hapi-plugin-mysql'),
    options: {
        host: "localhost",
        user: "root",
        password: ""
    }
}, function (err) {

    if (err) console.log(err);
    ...
});

server.route({
    method: 'GET',
    path: '/',
    handler: function (request, reply) {

        request.app.db.query(...)
            .then((result) => reply(result))
            .catch((err) => reply(err));
    }
});
```

The options are the same options you can pass onto the `mysql2` lib for making a connection. See <https://www.npmjs.com/package/mysql2> for more info on the `mysql2` lib itself.

The keyword `db` is used because `connection` is used by `hapi` and might cause confusion/collision.

If you want more manual control or you want to use the same pool outside of the hapi part of your server
you can initialize the pool before the plugin registration by calling `require('hapi-plugin-mysql-promise').init(options, callback)` and then call `require('hapi-plugin-mysql-promise').getConnection` to get a connection from the pool.
If you still want to register the plugin (to get all the goodies) just don't pass any options to the plugin registration
and it will use the same pool as first created.
To manually stop the pool call `require('hapi-plugin-mysql-promise').stop`.
See the tests for more granular use cases.

## Catches

- The releasing of the connection is handled on the `tail` event of the server. If you have handlers that reply early, with `reply.file()` for example, be sure to register a `tail` event and use that as callback.
- Transactions are no longer a part of this plugin and should be handled (with care) in your code

## Testing

- 100% code coverage!
- See `.travis.yml` and the tests for more info.

## Changelog

See the [releases](https://github.com/cospired/hapi-plugin-mysql-promise/releases) page
