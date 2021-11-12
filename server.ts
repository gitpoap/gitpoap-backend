require('dotenv').config();

import express from 'express';
import subscribeRouter from './routes/subscribe';
import { suggestRouter } from './routes/suggest';
import jwtRouter from './routes/jwt';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello world.  -GitPOAP');
})

/* Endpoints */
app.use('/jwt', jwtRouter);
app.use('/subscribe', subscribeRouter);
app.use('/suggest', suggestRouter);

app.listen(3000, () => {
    console.log('The application is listening on port 3000!');
})
