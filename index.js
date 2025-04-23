require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const { check, validationResult } = require('express-validator');
const cors = require('cors'); 

const app = express();
const port = process.env.PORT || 3001;


app.use(cors()); 
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
    connectionLimit: 10,
    queueLimit: 0
});


pool.getConnection((err, connection) => {
    if (err) {
        console.error('Database connection failed:', err);
    } else {
        console.log('Database connected successfully');
        connection.release();
    }
});


function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; 
    return d;
}


app.get('/test', (req, res) => {
    res.status(200).json({ message: 'Server is working' });
});


app.post('/addSchool', [
    check('name').notEmpty().trim().withMessage('Name is required'),
    check('address').notEmpty().trim().withMessage('Address is required'),
    check('latitude').isFloat().withMessage('Latitude must be a number'),
    check('longitude').isFloat().withMessage('Longitude must be a number')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, address, latitude, longitude } = req.body;
    
    console.log('Received school data:', { name, address, latitude, longitude });

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection:', err);
            return res.status(500).json({ error: 'Internal server error', details: err.message });
        }
        const query = 'INSERT INTO schools (name, address, latitude, longitude) VALUES (?, ?, ?, ?)';
        const values = [name, address, latitude, longitude];

        connection.query(query, values, (error, results) => {
            connection.release();
            if (error) {
                console.error('Error inserting school:', error);
                return res.status(500).json({ error: 'Failed to add school', details: error.message });
            }
            res.status(201).json({ message: 'School added successfully', schoolId: results.insertId });
        });
    });
});


app.get('/listSchools', [
    check('userLatitude').isFloat().withMessage('User Latitude must be a number'),
    check('userLongitude').isFloat().withMessage('User Longitude must be a number')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { userLatitude, userLongitude } = req.query;

    pool.getConnection((err, connection) => {
        if (err) {
            console.error('Error getting connection:', err);
            return res.status(500).json({ error: 'Internal server error', details: err.message });
        }
        const query = 'SELECT * FROM schools';

        connection.query(query, (error, results) => {
            connection.release();
            if (error) {
                console.error('Error fetching schools:', error);
                return res.status(500).json({ error: 'Failed to retrieve schools', details: error.message });
            }

            const schoolsWithDistance = results.map(school => {
                const distance = calculateDistance(
                    parseFloat(userLatitude),
                    parseFloat(userLongitude),
                    school.latitude,
                    school.longitude
                );
                return { ...school, distance };
            });

            schoolsWithDistance.sort((a, b) => a.distance - b.distance);
            res.status(200).json(schoolsWithDistance);
        });
    });
});


app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Available endpoints:');
    console.log(`- GET  http://localhost:${port}/test`);
    console.log(`- POST http://localhost:${port}/addSchool`);
    console.log(`- GET  http://localhost:${port}/listSchools?userLatitude=XX&userLongitude=YY`);
});