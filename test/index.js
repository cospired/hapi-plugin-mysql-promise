'use strict';

const Lab = require('lab');
const Code = require('code');
const Hapi = require('hapi');
const Hoek = require('hoek');

const lab = exports.lab = Lab.script();
const describe = lab.experiment;
const beforeEach = lab.beforeEach;
const afterEach = lab.afterEach;
const it = lab.it;
const expect = Code.expect;

const MySQL = require('mysql2/promise');

let connectWorking = true;
// TODO: add spies to check if functions were called
MySQL.createPool = (options) => options.pool ? {
    getConnection: () => {

        if (options.connect && connectWorking) {

            return Promise.resolve({
                query: () => options.query ? Promise.resolve('query ok') : Promise.reject('query error'),
                release: () => {}
            });
        }

        return Promise.reject('connection error');
    },
    end: () => options.disconnect ? Promise.resolve('pool end success') : Promise.reject('pool end error')
} : undefined;

const internals = {
    dbOptions: {
        host: 'mock',
        pool: true,
        connect: true,
        query: true,
        disconnect: true
    }
};

internals.requestHandler = function (request, reply) {

    const sql = 'INSERT INTO test SET id = null';

    return request.app.db.query(sql)
        .then( (result) => {
            return reply(result);
        })
        .catch( (err) => reply(err).code(400) );

};

describe('Hapi MySQL', () => {

    describe('Basics', () => {

        let server;

        beforeEach((done) => {
            connectWorking = true;
            server = new Hapi.Server();
            server.connection();
            done();
        });

        afterEach( (done) => {
            connectWorking = true;
            if(server) {
                server.stop((err) => {
                    // expect(err).to.not.exist();
                    done();
                });
            } else {
                done();
            }
        });

        it('Makes a db connection that works', (done) => {

            const options = Hoek.clone(internals.dbOptions);

            server.register({
                register: require('../'),
                options
            }, (err) => {

                expect(err).to.not.exist();

                server.route([{
                    method: 'GET',
                    path: '/test',
                    config: {
                        handler: internals.requestHandler
                    }
                }]);

                return server.inject({
                    method: 'GET',
                    url: '/test'
                }, (response) => {

                    expect(response.result, 'success result').to.equal('query ok');
                    expect(response.statusCode, 'success status code').to.equal(200);

                    done();
                });
            });
        });

        it('handle not getting a pool', (done) => {

            const options = Hoek.clone(internals.dbOptions);
            options.pool = false;

            server.register({
                register: require('../'),
                options
            }, (err) => {

                expect(err).to.exist();

                done();
            });
        });

        it('handle db connection errors', (done) => {

            const options = Hoek.clone(internals.dbOptions);
            options.connect = false;

            return server.register({
                register: require('../'),
                options
            }, (err) => {

                expect(err).to.equal('connection error');

                done();
            });
        });

        it('handle db disconnection errors', (done) => {

            const options = Hoek.clone(internals.dbOptions);
            options.disconnect = false;

            return server.register({
                register: require('../'),
                options
            }, (err) => {

                expect(err).to.not.exist();

                return server.stop((err) => {
                    expect(err).to.equal('pool end error');
                    server = null;
                    done();
                });

            });
        });

        it('handle query errors', (done) => {

            const options = Hoek.clone(internals.dbOptions);
            options.query = false;

            return server.register({
                register: require('../'),
                options
            }, (err) => {

                expect(err).to.not.exist();

                server.route([{
                    method: 'GET',
                    path: '/test',
                    config: {
                        handler: internals.requestHandler
                    }
                }]);

                return server.inject({
                    method: 'GET',
                    url: '/test'
                }, (response) => {

                    expect(response.result, 'success result').to.equal('query error');
                    expect(response.statusCode, 'success status code').to.equal(400);

                    done();
                });
            });
        });

        it('handle not getting a connection', (done) => {

            const options = Hoek.clone(internals.dbOptions);
            options.query = false;

            return server.register({
                register: require('../'),
                options
            }, (err) => {

                expect(err).to.not.exist();

                server.route([{
                    method: 'GET',
                    path: '/test',
                    config: {
                        handler: internals.requestHandler
                    }
                }]);

                connectWorking = false;

                return server.inject({
                    method: 'GET',
                    url: '/test'
                }, (response) => {

                    expect(response.result, 'error result').to.equal('connection error');
                    expect(response.statusCode, 'error status code').to.equal(500);

                    done();
                });
            });
        });

        it('Quite fail when connection is deleted', (done) => {

            const options = Hoek.clone(internals.dbOptions);

            return server.register({
                register: require('../'),
                options
            }, (err) => {

                expect(err).to.not.exist();

                server.route([{
                    method: 'GET',
                    path: '/test',
                    config: {
                        handler: (request, reply) => {

                            request.app.db = undefined;
                            return reply('ok');
                        }
                    }
                }]);

                return server.inject({
                    method: 'GET',
                    url: '/test'
                }, (response) => {

                    expect(response.statusCode, 'post status code').to.equal(200);
                    expect(response.result, 'post result').to.equal('ok');

                    done();
                });
            });
        });

        it('Pool is ended on Server.stop()', (done) => {

            const options = Hoek.clone(internals.dbOptions);

            const server = new Hapi.Server();
            server.connection();

            return server.register({
                register: require('../'),
                options
            }, (err) => {

                expect(err).to.not.exist();

                return server.start((err) => {

                    return server.stop((err) => {
                        expect(err).to.not.exist();
                        done();
                    });
                });
            });
        });
    });

    describe('Init', () => {

        it('Registers using `init`', (done) => {

            const options = Hoek.clone(internals.dbOptions);

            const MySQLPlugin = require('../');
            return MySQLPlugin.init(options, (err) => {

                expect(err).to.not.exist();

                return MySQLPlugin.stop(done);
            });
        });

        it('Registers with calling `init` and then using it as a plugin with no options', (done) => {

            const options = Hoek.clone(internals.dbOptions);

            const MySQLPlugin = require('../');
            return MySQLPlugin.init(options, (err) => {

                expect(err).to.not.exist();

                const server = new Hapi.Server();
                server.connection();

                return server.register({
                    register: MySQLPlugin
                }, (err) => {

                    expect(err).to.not.exist();

                    return server.stop(done);
                });
            });
        });

        it('Errors on registering twice', (done) => {

            const options = Hoek.clone(internals.dbOptions);

            const MySQLPlugin = require('../');
            return MySQLPlugin.init(options, (err) => {

                expect(err).to.not.exist();

                return MySQLPlugin.init(options, (err) => {

                    expect(err).to.be.an.error('There is already a pool configured');

                    return MySQLPlugin.stop(done);
                });
            });
        });

        it('Errors on registering with no host option', (done) => {

            const MySQLPlugin = require('../');
            return MySQLPlugin.init({}, (err) => {

                expect(err).to.be.an.error('Options must include host property');

                return done();
            });
        });

        it('Should not throw if stop has no parameters', (done) => {

            const options = Hoek.clone(internals.dbOptions);
            options.disconnect = false;

            const MySQLPlugin = require('../');
            return MySQLPlugin.init(options, (err) => {

                expect(err).to.not.exist();

                MySQLPlugin.stop();

                done();
            });
        });

        it('Errors when options are wrong', (done) => {

            const options = Hoek.clone(internals.dbOptions);

            const MySQLPlugin = require('../');
            return MySQLPlugin.init(options, (err) => {

                expect(err).to.not.exist();

                return MySQLPlugin.stop(done);
            });
        });

        // This test is mostly to hit the fallback part when no callback is provided to `stop`
        // If you know how to let `pool.end` actually error, please do PR ^^
        it('Errors throws when calling stop with no callback', (done) => {

            const options = Hoek.clone(internals.dbOptions);
            options.host = 'test';

            const MySQLPlugin = require('../');
            return MySQLPlugin.init(options, (err) => {

                expect(err).to.be.an.error();

                MySQLPlugin.stop();
                return done();
            });
        });
    });

    describe('Extras', () => {

        it('Exposes getDb on the server', (done) => {

            const options = Hoek.clone(internals.dbOptions);

            const server = new Hapi.Server();
            server.connection();

            return server.register({
                register: require('../'),
                options
            }, (err) => {

                expect(err).to.not.exist();
                expect(server.getDb, 'getDb').to.exist();

                return server.getDb()
                    .then( conn => {
                        expect(conn, 'db').to.exist();
                        return server.stop(done);
                    })
                    .catch( err => {
                        expect(err).to.not.exist();
                        return server.stop(done);
                    });
            });
        });

        it('Exposes `getConnection` on the module', (done) => {

            const MySQLPlugin = require('../');
            expect(MySQLPlugin.getConnection).to.be.a.function();

            return done();
        });

        it('Only registers once', (done) => {

            const options = Hoek.clone(internals.dbOptions);

            const server = new Hapi.Server();
            server.connection();

            return server.register([
                {
                    register: require('../'),
                    options
                }, {
                    register: require('../'),
                    options
                }
            ], (err) => {

                expect(err).to.not.exist();

                return server.start((err) => {

                    expect(err).to.not.exist();
                    expect(server.registrations['@cospired/hapi-plugin-mysql-promise']).to.be.an.object();

                    return server.stop(done);
                });
            });
        });

        it('Works on connectionless servers', (done) => {

            const options = Hoek.clone(internals.dbOptions);

            const server = new Hapi.Server();

            return server.register([
                {
                    register: require('../'),
                    options
                }, {
                    register: require('../'),
                    options
                }
            ], (err) => {

                expect(err).to.not.exist();

                return server.initialize((err) => {

                    expect(err).to.not.exist();
                    expect(server._registrations['@cospired/hapi-plugin-mysql-promise']).to.be.an.object();

                    return server.stop(done);
                });
            });
        });
    });
});
