require('dotenv').config();

import express from 'express';
import signupRouter from './routes/signup';
import jwtRouter from './routes/jwt';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello world.  -GitPOAP');
})

app.use('/jwt', jwtRouter);
app.use('/signup', signupRouter);

app.listen(3000, () => {
    console.log('The application is listening on port 3000!');
})
