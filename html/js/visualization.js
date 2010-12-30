var Connector = function(messageHandler) {
    var socket = new io.Socket();
    socket.on('connect', function() {
        console.log("Connected to server")
    })
    socket.on('disconnect', function() {
        console.log("Disconnect from server")
    })
    socket.on('message', function(messageString) {
        var message = JSON.parse(messageString);
        console.log("Message from server: " + message.message)
        messageHandler(message)
    });
    socket.connect();
};
var Handbrake = function(handler) {
    var queue = []
    setInterval(function() {
        if(queue.length > 0) {
            handler(queue.shift())
        }
    }, 1000)
    return function(message) {
        queue.push(message)
    }
}
var Pihtari = function(handler) {
    var queue = []
    $(document).click(function () {
        if(queue.length > 0) {
            handler(queue.shift())
        }
    })
    return function(message) {
        queue.push(message)
    }
}

var Router = function(handlers) {
    function wrap(handler) {
        if (document.location.search == "?pihtari") {
            return new Pihtari(handler)
        }
        if (document.location.search == "?handbrake") {
            return new Handbrake(handler)
        }
        return handler;
    }
    function onMessage(message) {
        var handler = handlers[message.message];
        if (handler) {
            handler(message);
        }
    }

    new Connector(wrap(onMessage))
};

var ChallengeMapper = function(initMessage) {
    function challengeId(challengeName) {
        for (i in initMessage.challenges) {
            if (initMessage.challenges[i].name == challengeName) {
                return i;
            }
        }
    }
    function associate(element, challengeName) {
        element.addClass('challenge-' + challengeId(challengeName))
    }
    function rowFor(challengeName) {
        return $('.challenge-results.challenge-' + challengeId(challengeName));
    }
    return {associate: associate, rowFor : rowFor}
}
var challengeMapper;

var ContenderMapper = function(initMessage) {
    function contenderId(contenderName) {
        for (i in initMessage.contenders) {
            if (initMessage.contenders[i] == contenderName) {
                return i;
            }
        }
    }
    function associate(element, contenderName) {
        element.addClass('contender-' + contenderId(contenderName))
    }
    function totalScoreCellFor(contenderName) {
        return $('.contender-total.contender-' + contenderId(contenderName))
    }
    return {
        contenderId : contenderId, associate: associate, totalScoreCellFor : totalScoreCellFor
    }
}
var contenderMapper;

var ResultMapper = function(initMessage) {
    function resultCellFor(challengeName, contenderName) {
        var challengeRow = challengeMapper.rowFor(challengeName);
        return $('.contender-result.contender-' + contenderMapper.contenderId(contenderName), challengeRow)
    }
    return {resultCellFor : resultCellFor}
}
var resultMapper;

function initHandler(initMessage) {
    challengeMapper = new ChallengeMapper(initMessage);
    contenderMapper = new ContenderMapper(initMessage);
    resultMapper = new ResultMapper(initMessage);
    Template.renderElements($('#contenders'), "contenders-name", initMessage.contenders, function(contenderName, element) {
        element.text(contenderName)
    })
    Template.renderElements($('#results'), "challenge-results", initMessage.challenges, function(challenge, challengeRow) {
        var cell = $('.challenge-name', challengeRow);
        cell.find(".name").text(challenge.name)
        cell.find(".ordinal").text("Tehtävä " + (initMessage.challenges.indexOf(challenge) + 1));
        challengeMapper.associate(challengeRow, challenge.name);
        Template.renderElements(challengeRow, "contender-result", initMessage.contenders, function(contenderName, contenderResultElement) {
            contenderMapper.associate(contenderResultElement, contenderName)
        })
    })
    Template.renderElements($('.total-results'), "contender-total", initMessage.contenders, function(contenderName, element) {
        contenderMapper.associate(element, contenderName)
    })
}
function challengeStartHandler(startMessage) {
    challengeMapper.rowFor(startMessage.challengeName).addClass("current");
}

function contenderFailHandler(failMessage) {
    var resultCell = resultMapper.resultCellFor(failMessage.challengeName, failMessage.contenderName)
    resultCell.addClass("fail");
}

function contenderReadyHandler(readyMessage) {
    var resultCell = resultMapper.resultCellFor(readyMessage.challengeName, readyMessage.contenderName)
    resultCell.addClass("success");
    resultCell.find(".result .weight").text(readyMessage.weight);
    resultCell.find(".result .value").text(readyMessage.value);
}

function challengeEndHandler(endMessage) {
    challengeMapper.rowFor(endMessage.challengeName).removeClass("current").addClass("completed");
    _.each(endMessage.scores, function(score, contenderName) {
        var resultCell = resultMapper.resultCellFor(endMessage.challengeName, contenderName)
        resultCell.children(".score").text(score)
        incrementTotal(contenderName, score)
    })
    function toInt(text) {
        if (!text.trim()) {
            return 0;
        }
        return parseInt(text);
    }
    function incrementTotal(contenderName, score) {
        var cell = contenderMapper.totalScoreCellFor(contenderName);
        cell.text(score + toInt(cell.text()));
    }
}

var handlers = {
    init : initHandler,
    challengeStart : challengeStartHandler,
    contenderFail : contenderFailHandler,
    contenderReady : contenderReadyHandler,
    challengeEnd : challengeEndHandler
};
$(function() {
    new Router(handlers)
})

