const express = require('express');
require('dotenv').config()
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;


// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if(!authorization) {
        return res.status(401).send({ error : true, message : 'unauthorized access'});
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if(err){
            return res.status(401).send({ error : true, message : 'unauthorized access'})
        }
        req.decoded = decoded;
        next();
    })
}



/* ---------------------------- MongoDB Part HERE ------------------------------ */


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bjkyc58.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
    }
});

async function run() {
    try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    
    // Collection Here
    const classCollection = client.db('cookingDb').collection('class');
    const instructorCollection = client.db('cookingDb').collection('instructor');
    const bookedCollection = client.db('cookingDb').collection('booked');
    const usersCollection = client.db('cookingDb').collection('users');
    const paymentCollection = client.db('cookingDb').collection('payments');
    
    app.post('/jwt', (req, res) => {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
        res.send({token});
    });


    const verifyAdmin = async(req, res, next) => {
        const email = req.decoded.email;
        const query = { email : email};
        const user = await usersCollection.findOne(query);
        if(user?.role !== 'admin'){
            res.status(403).send({email : true, message: 'Forbidden access'})
        }
        next();
    }
    
    const verifyInstructor = async(req, res, next) => {
        const email = req.decoded.email;
        const query = { email : email};
        const user = await usersCollection.findOne(query);
        if(user?.role !== 'instructor'){
            res.status(403).send({email : true, message: 'Forbidden access'})
        }
        next();
    }


    // Users related apis and collection
    app.get('/users', verifyJWT, verifyAdmin,  async(req, res) => {
        const result = await usersCollection.find().toArray();
        res.send(result);
    });

    app.post('/users', async(req, res) => {
        const user = req.body;
        const query = { email : user.email};
        const existingUser = await usersCollection.findOne(query);
        if(existingUser){
            return res.send({ message : 'User already Exists'});
        }

        const result = await usersCollection.insertOne(user);
        res.send(result);
    });

    app.get('/users/admin/:email', verifyJWT,  async(req, res) => {
        const email = req.params.email;
        if(req.decoded.email !== email){
            res.send({admin : false})
        }

        const query = { email : email }
        const user = await usersCollection.findOne(query);
        const result = { admin : user?.role === 'admin'};
        res.send(result);
    });

    app.patch('/users/admin/:id', async(req, res) => {
        const id = req.params.id;
        const filter = { _id : new ObjectId(id)};
        const updatedDoc = {
            $set: {
                role : 'admin'
            }
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
    });

    app.get('/users/instructor/:email', verifyJWT,  async(req, res) => {
        const email = req.params.email;
        if(req.decoded.email !== email){
            res.send({instructor : false})
        }

        const query = { email : email }
        const user = await usersCollection.findOne(query);
        const result = { instructor : user?.role === 'instructor'};
        res.send(result);
    });


    app.patch('/users/instructor/:id', async(req, res) => {
        const id = req.params.id;
        const filter = { _id : new ObjectId(id)};
        const updatedDoc = {
            $set: {
                role : 'instructor'
            }
        };
        const result = await usersCollection.updateOne(filter, updatedDoc);
        res.send(result);
    })

    
    // Class related apis and collection
    app.get('/class', async(req, res) => {
        const result = await classCollection.find().toArray();
        res.send(result);
    });

    app.post('/class', verifyJWT, verifyInstructor, async(req, res) => {
        const newCourse = req.body;
        const result = await classCollection.insertOne(newCourse);
        res.send(result);
    })



    // instructor related apis and collection
    app.get('/instructors', async(req, res) => {
        const result = await instructorCollection.find().toArray();
        res.send(result);
    })


    // Booked related apis and collection apis
    app.get('/booked', verifyJWT, async(req, res) => {
        const email = req.query.email;
        if(!email){
            res.send([]);
        }

        const decodedEmail = req.decoded.email;
        if(email !== decodedEmail){
            return res.status(403).send({ error : true, message : 'Forbidden access'})
        }

        const query = { email : email};
        const result = await bookedCollection.find(query).toArray();
        res.send(result);1
    })
    
    app.post('/booked', async(req, res) => {
        const item = req.body;
        // console.log(item);
        const result = await bookedCollection.insertOne(item);
        res.send(result);
    });

    app.delete('/booked/:id', async(req, res) => {
        const id = req.params.id;
        const query = { _id : new ObjectId(id)};
        const result = await bookedCollection.deleteOne(query);
        res.send(result);
    });

    // Payment
    app.post('/create-payment-intent', verifyJWT,  async(req, res) => {
        const { price } = req.body;
        const amount = price * 100;
        const paymentIntent = await stripe.paymentIntents.create({
            amount : amount,
            currency : 'usd',
            payment_method_types : ['card']
        });
        res.send({
            clientSecret : paymentIntent.client_secret
        })
    });

    // payment related api
    app.post('/payments', verifyJWT,  async(req, res) => {
        const payment = req.body;
        const insertResult = await paymentCollection.insertOne(payment);

        const query = {
            _id : {$in : payment.bookeditems.map(id => new ObjectId(id))}
        }
        const deleteResult = await bookedCollection.deleteMany(query);

        res.send({insertResult, deleteResult});
    });

    app.get('/payments', async(req, res) => {
        const result = await paymentCollection.find().toArray();
        res.send(result);
    })
    
    
    
    
    
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
    }
}
run().catch(console.dir);



/* ---------------------------- MongoDB Part HERE ------------------------------ */



app.get('/', (req, res) => {
    res.send('Cooking Camp is running');
});

app.listen(port, () => {
    console.log(`Cooking Camp is running on port : ${port}`);
})