'use strict';

const MySQL = require('mysql2/promise');
const Hoek = require('hoek');

const internals = {
    pool: null
};

internals.attachConnection = (request, reply) => {

    internals.getConnection()
    .then( conn => {
        request.app.db = conn;

        reply.continue();
    })
    .catch( err => {

        reply(err).code(500);
    });
};

exports.getConnection = internals.getConnection = (callback) => {

    return internals.pool.getConnection();
};

internals.tail = (request) => {

    if (request.app.db) {
        request.app.db.release();
    }
};

exports.stop = internals.stop = (server, next) => {

    if (typeof server === 'function' && !next) {
        next = server;
    }

    // This is also used for `on('stop')` which does not pass a `next` callback
    // If no callback we throw on error
    internals.pool.end()
        .then( () => {
            delete internals.pool;

            if(next) next();
        })
        .catch( (err) => {

            delete internals.pool;

            if(next) {
                next(err)
            }
        });
};

exports.init = internals.init = (baseOptions, callback) => {

    const hasOptions = Object.keys(baseOptions).length > 0;

    // Error on trying to init multiple times
    if (internals.pool) {

        if (hasOptions) {
            callback(new Error('There is already a pool configured'));
        } else {
            // Calling init and then register with no options should work
            console.log("yippee")
            callback();
        }

        return;
    }

    if (!baseOptions.hasOwnProperty('host')) {
        callback(new Error('Options must include host property'));
        return;
    }

    const options = Hoek.clone(baseOptions);
    internals.pool = MySQL.createPool(options);

    if(!internals.pool) return callback(new Error('No mysql pool found'));

    // test connection
    internals.getConnection()
    .then( conn => {
        conn.release();
        callback();
    })
    .catch( err => {
        internals.stop();
        callback(err);
    });
}

exports.register = (server, baseOptions, next) => {

    return internals.init(baseOptions, (err) => {

        if(err) {
            next(err);
            return;
        }

        // add connection to request object
        if (server.connections) {
            server.ext('onPreAuth', internals.attachConnection);
        }

        // end connection after request finishes
        server.on('tail', internals.tail);

        // try to close pool on server end
        if (server.connections) {
            server.ext('onPostStop', internals.stop);
        }
        else {
            server.on('stop', internals.stop)
        }

        // add getDb() function to `server`
        server.decorate('server', 'getDb', internals.getConnection);

        server.log(['hapi-plugin-mysql', 'database'], 'Connection to the database successfull');

        next();
    });
};

exports.register.attributes = {
    pkg: require('../package.json'),
    once: true,
    connections: 'conditional'
};
