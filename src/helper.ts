function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

//auto interpolation of a template string
function interpolate(str: string, channel: string, username: string, ) {
    return str.replace("{channel}", channel).replace("{username}", username);
}

function setIntervalImmediately(func: () => any, interval: number) {
    func();
    return setInterval(func, interval);
}

export { sleep, interpolate, setIntervalImmediately };