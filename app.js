const app = require('express')();
let server = require('http').Server(app);
const io = require('socket.io')(server);

const bodyParser = require('body-parser');
app.use(bodyParser.json());
const cors = require('cors');
app.use(cors());


let dispensing = false;
let timeLeft = 0;
let gQuantity = 0
let interval;

function startDispense(quantity) {

    if (quantity && quantity > 0) {

        dispensing = true;

        gQuantity = quantity;
        const totalTime = quantity * 10
        timeLeft = totalTime;


        console.log("Start dispensing " + quantity + " mL\n")

        interval = setInterval(function () {

            if (timeLeft <= 0) {

                dispensing = false;
                gQuantity = 0;
                timeLeft = 0;

                io.emit('dispense', {
                    status: 2,
                    quantity: quantity,
                    current: quantity
                });

                clearInterval(interval);
                console.log("Dispense completed: " + quantity + " mL\n")

            } else {

                timeLeft = timeLeft - 100

                const currentQty = quantity - Math.floor((timeLeft / 10));

                io.emit('dispense', {
                    status: 1,
                    quantity: quantity,
                    current: currentQty
                });

                console.log("Dispensed: " + currentQty + " mL")
            }

        }, 100);

    } else {

        io.emit('dispense', {
            status: -2,
            quantity: quantity,
            current: 0
        });

        dispensing = false;
        gQuantity = 0;
        timeLeft = 0;

    }

}


// dispense status: 0 starting, 1 dispensing, 2 completed, -1 interrupted, -2 failed
app.post('/api/dispense/quantity/:clientId/:qty', (req, res, next) => {

    if (io.sockets.connected[req.params.clientId]) {

        const quantity = parseInt(req.params.qty)
        if (quantity && quantity > 0) {

            if (dispensing === true) {
                return res.status(500).send({
                    message: "Already dispensing, please wait!"
                })
            } else {
                io.emit('dispense', {
                    status: 0,
                    quantity: quantity,
                    current: 0
                });
                startDispense(quantity);
                return res.status(200).send({
                    message: "Dispense started"
                });
            }
        }
    } else {

        return res.status(401).send({
            message: "Unauthorized client!"
        });

    }

});

app.post('/api/dispense/interrupt/:clientId', (req, res, next) => {

    if (io.sockets.connected[req.params.clientId]) {


        if (dispensing === true) {

            const interruptedAt = gQuantity - Math.floor((timeLeft / 10));
            dispensing = false;
            gQuantity = 0;
            timeLeft = 0;

            io.emit('dispense', {
                status: -1,
                quantity: gQuantity,
                current: interruptedAt
            })

            clearInterval(interval);

            console.log("Dispense interrupted at " + interruptedAt + " mL\n")

            return res.status(200).send({
                message: "Dispense interrupted!"
            });

        } else {
            return res.status(500).send({
                message: "Not dispensing currently!"
            });
        }
    } else {
        return res.status(401).send({
            message: "Unauthorized client!"
        });
    }
});

const PORT = process.env.PORT || 5500;
server.listen(PORT, () => {
    console.log(`Server Running on port: ${PORT}`);
});

io.use((socket, next) => {

    if (io.engine.clientsCount > 1) {
        next(new Error("Connection limit reached!"));
        console.log("Connection limit reached!")
    } else {
        next();
    }

}).on('connection', socket => {

    const clientid = socket.client.id;
    console.log(socket.client.id + " connected");

    socket.on('disconnect', () => {
        console.log(socket.client.id + ' disconnected!');
    });
});