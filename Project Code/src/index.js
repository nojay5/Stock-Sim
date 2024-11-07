/*
Section 1: Import the necessary dependencies. Remember to check what each dependency does.
Section 2: Connect to DB: Initialize a dbConfig variable that specifies the connection information for the database. The variables in the .env file can be accessed by using process.env.POSTGRES_DB, process.env.POSTGRES_USER, process.env.POSTGRES_PASSWORD and process.env.API_KEY.
Section 3: App Settings
Section 4: This is where you will add the implementation for all your API routes
Section 5: Starting the server and keeping it active.

*/

// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************

const express = require('express'); // To build an application server or API
const app = express();
const pgp = require('pg-promise')(); // To connect to the Postgres DB from the node server
const bodyParser = require('body-parser');
const session = require('express-session'); // To set the session object. To store or access session data, use the `req.session`, which is (generally) serialized as JSON by the store.
const bcrypt = require('bcrypt'); //  To hash passwords
const axios = require('axios'); // To make HTTP requests from our server. We'll know more about it in Part B.
const { request } = require('chai');

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

// database configuration
const dbConfig = {
 host: 'db', // the database server
 port: 5432, // the database port
 database: process.env.POSTGRES_DB, // the database name
 user: process.env.POSTGRES_USER, // the user account to connect with
 password: process.env.POSTGRES_PASSWORD, // the password of the user account
};

const db = pgp(dbConfig);

// test your database
db.connect()
 .then(obj => {
   console.log('Database connection successful'); // you can view this message in the docker compose logs
   obj.done(); // success, release the connection;
 })
 .catch(error => {
   console.log('ERROR:', error.message || error);
 });

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

app.set('view engine', 'ejs'); // set the view engine to EJS
app.use(bodyParser.json()); // specify the usage of JSON for parsing request body.

// initialize session variables
app.use(
 session({
   secret: process.env.SESSION_SECRET,
   saveUninitialized: false,
   resave: false,
 })
);

app.use(
 bodyParser.urlencoded({
   extended: true,
 })
);

app.use( express.static( "public" ) );

// *****************************************************
// <!-- Section 4 : API Routes -->
// *****************************************************

app.get('/', (req, res) => {
 res.render('pages/landing')
});

app.get('/welcome', (req, res) => {
  res.json({ status: 'success', message: 'Welcome!' });
});
app.get('/intro', (req, res) => {
  res.render('pages/intro')
 });

 app.get('/fundamentals', (req, res) => {
  res.render('pages/fundamentals')
 });

 app.get('/technical', (req, res) => {
  res.render('pages/technical')
 });

 app.get('/portfolio', (req, res) => {
  res.render('pages/portfolio')
 });

 app.get('/quiz', (req, res) => {
  res.render('pages/quiz')
 });

 app.get('/home', async (req, res) => {
  try {
    const apiKey = 'cl9s089r01qk1fmlilp0cl9s089r01qk1fmlilpg'; 
    const marketStatusResponse = await axios.get('https://finnhub.io/api/v1/stock/market-status', {
      params: {
        exchange: 'US',
        token: apiKey,
      },
    });

    const marketStatus = marketStatusResponse.data;
    const newsResponse = await axios.get('https://finnhub.io/api/v1/news', {
      params: {
        token: apiKey,
        category: 'general',
        minId: 0,
        size: 3,
      },
    });

    const stockResponseAAPL = await axios.get('https://finnhub.io/api/v1/quote?symbol=AAPL', {
      params: {
        token: apiKey,
        symbol: 'AAPL',
      },
    });
    const stockResponseTSLA = await axios.get('https://finnhub.io/api/v1/quote?symbol=TSLA', {
      params: {
        token: apiKey,
        symbol: 'TSLA',
      },
    });
    const stockResponseMSFT = await axios.get('https://finnhub.io/api/v1/quote?symbol=MSFT', {
      params: {
        token: apiKey,
        symbol: 'MSFT',
      },
    });
 
    const tsla = stockResponseTSLA.data;
    const aapl = stockResponseAAPL.data;
    const msft = stockResponseMSFT.data;

    const marketNews = newsResponse.data;
    const formattedNews = marketNews.map(news => {
      return {
        headline: news.headline,
        image: news.image,
        summary: news.summary,
      };
    });

    const result = await db.query(`
        SELECT
            COALESCE(SUM(CASE WHEN t.transaction_type = 'buy' THEN t.transaction_price ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN t.transaction_type = 'sell' THEN t.transaction_price ELSE 0 END), 0) AS account_balance
        FROM
            Transactions t
        WHERE
            t.user_id = $1;
    `, [req.session.user.user_id]);

    let accountBalance = result.account_balance;
    if (accountBalance == null) accountBalance = 0;
    accountBalance = accountBalance + 50000;

    res.render('pages/home', { user: req.session.user, accountBalance, events: formattedNews, marketStatus, tsla, aapl, msft});
} catch (error) {
    console.error('Error fetching data:', error.message);
    res.status(500).send('Internal Server Error');
}
 });
 

app.get('/register', (req,res) => {
 //register
 res.render('pages/register')
});
app.get('/login', (req, res) => {
  const username = req.body
  const password = req.body
  res.render('pages/login');
});

app.get('/account', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN t.transaction_type = 'buy' THEN t.transaction_price ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN t.transaction_type = 'sell' THEN t.transaction_price ELSE 0 END), 0) AS account_balance
      FROM
        Transactions t
      WHERE
        t.user_id = $1;
    `, [req.session.user.user_id]);

    let accountBalance = result.account_balance;
    if(accountBalance == null) accountBalance = 0;
    accountBalance = accountBalance + 50000;

    res.render('pages/account', {user: req.session.user, accountBalance });
  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).send('Internal Server Error');
  }
});

 app.get('/learn', async (req,res) => {
  try {
    const apiKey = 'clkkmapr01qkcrcfurv0clkkmapr01qkcrcfurvg'; // Finnhub API key

    var { data }  = await axios.get(`https://finnhub.io/api/v1/news`, { //call to finnhub api
      params: {
        token: apiKey,
        category: 'general',
        minId: 0,
      },
    });

    const NavNews = data; //take data into something we can uss
    
    // console.log(NavNews[0].headline); --testing stuff

    res.render('pages/learn', { NavNews })
    //res.json({ stockCandleData, stockSymbol });
  } catch (error) {
    console.error('Error fetching stock news:', error.message);
    res.status(500).send('Internal Server Error');
  }
  
 });

//Register endpoint
app.post('/register', async (req, res) => {
  try {
    const hash = await bcrypt.hash(req.body.password, 10);
    const username = req.body.username;

    // Check if the username already exists
    const checkQuery = 'SELECT * FROM users WHERE username = $1;';
    const checkResult = await db.oneOrNone(checkQuery, [username]);

    if (checkResult) {
      return res.redirect('/login?error=' + encodeURIComponent('Username_Exists'));
    }

    // Username doesn't exist, proceed with registration
    const insertQuery = 'INSERT INTO users (username, password) VALUES ($1, $2);';
    const data = await db.one(insertQuery, [username, hash]);

    // Registration successful, redirect to login with success message
    // Need to implement success message on UI
    res.redirect('/login');
  } catch (err){
    // Redirect to registration with error message in case of an error
    console.error('Error occurred during registration:', err);
    res.redirect('/register');
  }
});

app.post('/change_password', async (req, res) =>{
  try{
      const query = 'SELECT * FROM users WHERE user_id = $1';
      const userData = await db.oneOrNone(query, [req.session.user.user_id]);
      const hash = await bcrypt.hash(req.body.password, 10);
      if (userData) {
          const insertQuery = 'UPDATE users SET password = $1 WHERE user_id = $2';
          const data = await db.none(insertQuery, [hash,req.session.user.user_id]);
          console.log('changed password');
          res.redirect('/account');
      }
    }catch(err){
      console.error('Error occurred during password change', err);
      res.redirect('/account');
    }
})

// Login endpoint
app.post('/login', async (req, res) => {
  try {
    const query = 'SELECT * FROM users WHERE username = $1';
    const userData = await db.oneOrNone(query, [req.body.username]);

    if (userData) {
      const match = await bcrypt.compare(req.body.password, userData.password);

      if (match) {
        // Passwords match, set session and redirect to /invest
        req.session.user = userData;
        req.session.save();
        //log user data in session
        console.log('User data stored in session:', userData);
        res.redirect('/home');
        //return res.status(200).json({ status: 'success', message: 'Welcome!' });
      } else {
        // Incorrect password, redirect to register
        res.redirect('/register?error=' + encodeURIComponent('Incorrect Password'));
        /*
        return res.status(400).json({
          status: 'error',
          message: 'Incorrect username or password. If you do not have an account, please register.',
          redirect: '/register', // Include relative redirect in the response
        });
        */
      }
    } else {
      // User not found, redirect to register
      res.redirect('/register');
      /*
      return res.status(400).json({
        status: 'error',
        message: 'Incorrect username or password. If you do not have an account, please register.',
        redirect: '/register', // Include relative redirect in the response
      });
      */
    }
  }catch(err){
    console.error('Error occurred during login:', err);
    res.status(500).json({
      status: 'error',
      message: 'Internal Server Error',
    });
  }
});

app.post('/transactShares', async (req, res) => {
  try{
    const num_shares = req.body.shares;
    const share_price = req.body.price;
    let transact_date = req.body.date;
    let type = req.body.type;
    const stock_id = await db.query(`
      SELECT stock_id
      FROM Stocks
      WHERE name = $1
    `, [req.body.stock_name]);

    const user_id= await db.query(`
      SELECT user_id
      FROM users
      WHERE user_id = $1
      `, [req.session.user.user_id]);

    const result = await db.query(`
      INSERT INTO Transactions
        (user_id,
        stock_id,
        transaction_type,
        transaction_date,
        transaction_price)
      VALUES ($1, $2, $3, $4, $5)
    `, [user_id,  stock_id, type, transact_date, share_price]);
    res.send('Transaction completed successfully');
  }catch (err) {
    console.error('Unable to buy shares.', err);
  }
});

const auth = (req, res, next) => {
  console.log('Session:', req.session); // Log the session information
  if (!req.session.user) {
    // Default to login page.
    return res.redirect('/login');
  }
  next();
};


// Authentication Required
app.use(auth);

app.get('/user', auth, async (req, res) => {
  try {
    const userId = req.session.user.user_id;
    const user = await db.query('SELECT * FROM users WHERE user_id = $1', [userId]);
  
    res.json(user);
  } catch (error) {
    console.error('Error fetching user information:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

//get transacton information from database
app.get('/transactions', auth, async (req, res) => {
  try {
    const userId = req.session.user.user_id;
    const result = await db.query('SELECT * FROM transactions WHERE user_id = $1', [userId]);
    const transactions = result.rows;
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transaction information:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/user_balance', async (req, res) => {
  try{
    const user_id = req.session.user.user_id;
    const result = await db.query(`
    SELECT
      COALESCE(SUM(CASE WHEN t.transaction_type = 'sell' THEN t.transaction_price ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN t.transaction_type = 'buy' THEN t.transaction_price ELSE 0 END), 0) AS account_balance
    FROM
      Transactions t
    WHERE
      t.user_id = $1;
    `, [user_id]);

    let balance = result.account_balance;
    if(balance == null) balance = 0;
    balance = balance + 50000;

    res.json(balance);
  } catch (error){
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.get('/invest', async (req, res) => {
  try {
    let stockSymbol = req.query.stockSymbol //'AAPL'; // Replace with your desired stock symbol
    if (stockSymbol === undefined) {
      stockSymbol = "AAPL";
    }
    const multiplier = '1';
    const timespan = 'day';
    const fromDate = '2022-01-09';
    const toDate = '2023-01-09';
    const adjusted = 'true';
    const sort = 'asc';
    const apiKey = '1aaoniwZvusnCcRBFvvsDxiO_doMNZ0u'; // Replace with your Polygon.io API key



    //const { data } = await axios.get(`https://api.polygon.io/v2/aggs/ticker/${stockSymbol}/range/1/day/2022-01-09/2023-01-09?apiKey=${apiKey}`);
    const { data } = await axios.get(`https://api.polygon.io/v2/aggs/ticker/${stockSymbol}/range/${multiplier}/${timespan}/${fromDate}/${toDate}?apikey=${apiKey}`, {
      params: {
        apiKey: apiKey,
        //from: fromDate,
        //to: toDate,
        adjusted: adjusted,
        sortOrder: sort,
      },
    });
    // Check if data is available in the response
    if (!data.results || data.results.length === 0) {
      console.error('No results found in the API response.');
      return res.status(500).send('Internal Server Error');
    }

    // Extracted data object
    const stockCandleData = {
      openPrices: data.results.map(result => result.o),
      closePrices: data.results.map(result => result.c),
      highPrices: data.results.map(result => result.h),
      lowPrices: data.results.map(result => result.l),
      timestamps: data.results.map(result => result.t),
      volumes: data.results.map(result => result.v),
    };

    // Render the 'pages/invest' view with the extracted data
    res.render('pages/invest', { stockCandleData, stockSymbol });

    // Optionally, you can store the extracted data in a database or file
    // Example: storeStockDataInDatabase(stockCandleData);

  } catch (error) {
    console.error('Error fetching stock candle data:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

/*

// API call for stock search
app.get('/stockData', async (req, res) => {
  try {
    const stockSymbol = req.query.stockSymbol || 'AAPL'; // Default to 'AAPL' if no symbol is provided
    const apiKey = 'cl9s089r01qk1fmlilp0cl9s089r01qk1fmlilpg'; // Replace with your Finnhub API key
    const resolution = 'D'; // Use daily resolution for simplicity
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 3650); // Set fromDate to 10 years ago

    const { data } = await axios.get(`https://finnhub.io/api/v1/stock/candle`, {
      params: {
        symbol: stockSymbol,
        token: apiKey,
        resolution: resolution,
        from: Math.floor(fromDate.getTime() / 1000),
        to: Math.floor(new Date().getTime() / 1000),
      },
    });
    const stockCandleData = {
      openPrices: data.o,
      closePrices: data.c,
      highPrices: data.h,
      lowPrices: data.l,
      timestamps: data.t,
      volumes: data.v,
    };

    res.json({ stockCandleData, stockSymbol });
  } catch (error) {
    console.error('Error fetching stock candle data:', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

*/

// API Call for pie chart in Portfolio

// API Call for pie chart in Portfolio
app.get('/portfolio', async (req, res) => {
  try {
    // Define the data object
    const data = {
      labels: ['Red', 'Blue', 'Yellow'],
      datasets: [{
        label: 'My First Dataset',
        data: [300, 50, 100],
        backgroundColor: [
          'rgb(255, 99, 132)',
          'rgb(54, 162, 235)',
          'rgb(255, 205, 86)'
        ],
        hoverOffset: 4
      }]
    };

    // Configure the chart
    const config = {
      type: 'doughnut',
      data: data,
    };

    // Send the response
    res.json(config);

  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// API Call for top 5 stocks on volume of the day 
/* WORKING ON IT RN - JON
app.get('/topStocks', async (req, res) => {
  try {
    const apiKey = 'cl9s089r01qk1fmlilp0cl9s089r01qk1fmlilpg'; // Replace with your API key
    const response = await axios.get('https://financial-data-api.com/api/v1/stock?limit=5&order=volume&apikey=' + apiKey);
    const topStocks = response.data;

    console.log('Top Stocks:', topStocks); // Log the topStocks data

    res.render('pages/home', { topStocks });
  } catch (error) {
    console.error('Error fetching top stocks:', error.message);
    res.status(500).send('Internal Server Error');
  }
});


// Invoke API route in home 
app.get('/home', async (req, res) => {
  try {
    // Fetch top 5 stocks with highest volume
    const response = await axios.get('/topStocks');
    const topStocks = response.data;

    // Render 'home.ejs' with top stocks data
    res.render('pages/home', { topStocks });
  } catch (error) {
    console.error('Error fetching top stocks:', error.message);
    res.status(500).send('Internal Server Error');
  }
});

*/



/* MANUAL INPUT OF STOCK SYMBOL 
app.get('/stockSymbol', (req, res) => {
  const stockSymbol = 'AAPL';  
  res.render('menu', { stockSymbol }); 
});
*/


/* TRY TO RETRIEVE USERNAME FROM USER SESSION WHEN SUCCESSFULLY LOGGED IN
app.get('/home', (req, res) => {
  const username = req.session.user ? req.session.user.username : 'Guest';
  const renderedHTML = res.render('pages/home', { username });
  console.log('Rendered HTML:', renderedHTML);
});
*/

app.get("/logout", (req, res) => {
 req.session.destroy();
 res.render('pages/landing', { message: "Logged out Successfully"});
});

//dummy API for test

app.get('/welcome', (req, res) => {
  res.json({status: 'success', message: 'Welcome!'});
});

// *****************************************************
// <!-- Section 5 : Start Server-->
// *****************************************************
// starting the server and keeping the connection open to listen for more requests
module.exports = app.listen(3000);
console.log('Server is listening on port 3000');