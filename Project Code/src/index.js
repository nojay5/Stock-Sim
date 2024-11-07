// *****************************************************
// <!-- Section 1 : Import Dependencies -->
// *****************************************************

const express = require('express');
const app = express();
const pgp = require('pg-promise')();
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const axios = require('axios');
const session = require('express-session');

// *****************************************************
// <!-- Section 2 : Connect to DB -->
// *****************************************************

const dbConfig = {
  host: 'localhost',
  port: 5432,
  database: 'stock_sensei',
  user: 'postgres',
  password: '2NLH&1plo!',
};

const db = pgp(dbConfig);

db.connect()
  .then(obj => {
    console.log('Database connection successful');
    obj.done();
  })
  .catch(error => {
    console.log('ERROR:', error.message || error);
  });

// *****************************************************
// <!-- Section 3 : App Settings -->
// *****************************************************

app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Configure sessions
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// *****************************************************
// <!-- Section 4 : Authentication Middleware -->
// *****************************************************

const auth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

// *****************************************************
// <!-- Section 5 : API Routes -->
// *****************************************************

app.get('/', (req, res) => res.render('pages/landing'));
app.get('/home', auth, async (req, res) => {
  try {
    // Sample data for marketStatus
    const marketStatus = {
      exchange: "NYSE",
      session: "Pre-market",
      isOpen: true
    };

    const marketNews = [
      { headline: "Sample News 1", image: "sample1.jpg", summary: "Sample summary 1" },
      { headline: "Sample News 2", image: "sample2.jpg", summary: "Sample summary 2" },
    ];

    // Sample stock data for aapl, tsla, msft
    const aapl = { c: 150.23, d: 1.25 };
    const tsla = { c: 720.54, d: -10.18 };
    const msft = { c: 299.87, d: 0.67 };

    const accountBalanceQuery = await db.oneOrNone(
      `SELECT COALESCE(SUM(CASE WHEN t.transaction_type = 'buy' THEN t.transaction_price ELSE 0 END) -
               SUM(CASE WHEN t.transaction_type = 'sell' THEN t.transaction_price ELSE 0 END), 0) AS account_balance 
       FROM Transactions t WHERE t.user_id = $1;`, 
      [req.session.user.user_id]
    );

    const accountBalance = (accountBalanceQuery?.account_balance || 0) + 50000;

    res.render('pages/home', { user: req.session.user, accountBalance, events: marketNews, marketStatus, aapl, tsla, msft });
  } catch (error) {
    console.error('Error fetching data:', error.message);
    res.status(500).send('Internal Server Error');
  }
});


// app.get('/home', auth, async (req, res) => {
//   try {
//     // Temporarily comment out external API calls to isolate the error source
//     // const apiKey = 'cl9s089r01qk1fmlilp0cl9s089r01qk1fmlilpg';
//     // const marketStatusResponse = await axios.get('https://finnhub.io/api/v1/stock/market-status', { params: { token: apiKey } });
//     // const newsResponse = await axios.get('https://finnhub.io/api/v1/news', { params: { token: apiKey, category: 'general', minId: 0, size: 3 } });
    
//     // Sample data to avoid API calls temporarily
//     const marketNews = [
//       { headline: "Sample News 1", image: "sample1.jpg", summary: "Sample summary 1" },
//       { headline: "Sample News 2", image: "sample2.jpg", summary: "Sample summary 2" },
//     ];
//     const accountBalanceQuery = await db.oneOrNone(
//       `SELECT COALESCE(SUM(CASE WHEN t.transaction_type = 'buy' THEN t.transaction_price ELSE 0 END) -
//                SUM(CASE WHEN t.transaction_type = 'sell' THEN t.transaction_price ELSE 0 END), 0) AS account_balance 
//        FROM Transactions t WHERE t.user_id = $1;`, 
//       [req.session.user.user_id]
//     );

//     const accountBalance = (accountBalanceQuery?.account_balance || 0) + 50000;

//     res.render('pages/home', { user: req.session.user, accountBalance, events: marketNews });
//   } catch (error) {
//     console.error('Error fetching data:', error.message);
//     res.status(500).send('Internal Server Error');
//   }
// });

app.get('/register', (req, res) => res.render('pages/register'));
app.get('/login', (req, res) => res.render('pages/login'));

app.post('/register', async (req, res) => {
  try {
    const hash = await bcrypt.hash(req.body.password, 10);
    const userExists = await db.oneOrNone('SELECT * FROM users WHERE username = $1;', [req.body.username]);

    if (userExists) return res.redirect('/login?error=Username_Exists');

    await db.none('INSERT INTO users (username, password) VALUES ($1, $2);', [req.body.username, hash]);
    res.redirect('/login');
  } catch (err) {
    console.error('Error occurred during registration:', err);
    res.redirect('/register');
  }
});

app.post('/login', async (req, res) => {
  try {
    const query = 'SELECT * FROM users WHERE username = $1';
    const userData = await db.oneOrNone(query, [req.body.username]);

    if (userData) {
      const match = await bcrypt.compare(req.body.password, userData.password);

      if (match) {
        req.session.user = userData;
        console.log('User logged in successfully:', userData);  // Log success
        res.redirect('/home');
      } else {
        console.log('Incorrect password for user:', req.body.username);  // Log incorrect password
        res.redirect('/login?error=Incorrect_Password');
      }
    } else {
      console.log('User not found:', req.body.username);  // Log user not found
      res.redirect('/register');
    }
  } catch (err) {
    console.error('Error occurred during login:', err);  // Log specific error
    res.status(500).json({
      status: 'error',
      message: 'Internal Server Error during login',
    });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.render('pages/landing', { message: "Logged out Successfully" });
});

app.get('/account', auth, async (req, res) => {
  try {
    const accountBalanceQuery = await db.oneOrNone(
      `SELECT COALESCE(SUM(CASE WHEN t.transaction_type = 'buy' THEN t.transaction_price ELSE 0 END) -
               SUM(CASE WHEN t.transaction_type = 'sell' THEN t.transaction_price ELSE 0 END), 0) AS account_balance 
       FROM Transactions t WHERE t.user_id = $1;`,
      [req.session.user.user_id]
    );
    const accountBalance = (accountBalanceQuery?.account_balance || 0) + 50000;

    res.render('pages/account', { user: req.session.user, accountBalance });
  } catch (error) {
    console.error('Error fetching account balance:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/change_password', auth, async (req, res) => {
  try {
    const hash = await bcrypt.hash(req.body.password, 10);
    await db.none('UPDATE users SET password = $1 WHERE user_id = $2', [hash, req.session.user.user_id]);
    res.redirect('/account');
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/transactShares', auth, async (req, res) => {
  try {
    const { shares, price, date, type, stock_name } = req.body;
    const stock_id = await db.one('SELECT stock_id FROM Stocks WHERE name = $1', [stock_name]);
    await db.none(
      `INSERT INTO Transactions (user_id, stock_id, transaction_type, transaction_date, transaction_price) 
       VALUES ($1, $2, $3, $4, $5)`, 
      [req.session.user.user_id, stock_id.stock_id, type, date, price * shares]
    );
    res.send('Transaction completed successfully');
  } catch (err) {
    console.error('Unable to transact shares:', err);
    res.status(500).send('Internal Server Error');
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

// *****************************************************
// <!-- Section 6 : Start Server -->
// *****************************************************

const PORT = process.env.PORT || 8060;
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
