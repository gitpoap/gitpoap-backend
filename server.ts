require('dotenv').config();

import express from 'express';
import subscribeRouter from './routes/subscribe';
import jwtRouter from './routes/jwt';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello world.  -GitPOAP');
})

app.use('/jwt', jwtRouter);
app.use('/subscribe', subscribeRouter);

app.listen(3000, () => {
    console.log('The application is listening on port 3000!');
})
