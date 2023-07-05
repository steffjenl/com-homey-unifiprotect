module.exports = {
    async getStatus({ homey, query }) {
        const result = await homey.app.api.loggedInStatus;
        return result;
    },
    async getWebsocketStatus({ homey, query }) {
        const result = await homey.app.api.ws.loggedInStatus;
        return result;
    },
};
