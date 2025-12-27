// Vercel Cron Job - Fetch & Save Jakarta Weather Every 3 Hours
// This keeps Supabase database active (prevents 1-week inactivity pause)

const axios = require('axios');
const { initDatabase, closePool } = require('../../config/supabase');

// Jakarta Pusat ADM4 code
const JAKARTA_ADM4 = '31.71.01.1001';

async function fetchAndSaveWeather() {
  let db = null;
  
  try {
    // Initialize database
    db = await initDatabase();
    
    // Create weather_logs table if not exists
    await db.execute(`
      CREATE TABLE IF NOT EXISTS weather_logs (
        id SERIAL PRIMARY KEY,
        adm4_code VARCHAR(20) NOT NULL,
        location_name VARCHAR(100),
        weather_data JSONB,
        temperature DECIMAL(5,2),
        humidity INTEGER,
        weather_desc VARCHAR(100),
        fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create index for faster queries
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_weather_logs_adm4 ON weather_logs(adm4_code)
    `);
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_weather_logs_fetched ON weather_logs(fetched_at DESC)
    `);
    
    // Fetch weather from BMKG
    const bmkgUrl = `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${JAKARTA_ADM4}`;
    const response = await axios.get(bmkgUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'PanganJawara-WeatherCron/1.0',
        'Accept': 'application/json'
      }
    });
    
    const data = response.data;
    
    // Extract weather info
    let locationName = 'Jakarta Pusat';
    let temperature = null;
    let humidity = null;
    let weatherDesc = null;
    
    if (data?.data?.[0]) {
      const lokasi = data.data[0].lokasi;
      locationName = `${lokasi?.desa || ''}, ${lokasi?.kecamatan || ''}, ${lokasi?.kota || ''}`.trim();
      
      // Get current/latest weather
      const cuaca = data.data[0].cuaca;
      if (cuaca && cuaca.length > 0 && cuaca[0].length > 0) {
        const current = cuaca[0][0];
        temperature = current.t || null;
        humidity = current.hu || null;
        weatherDesc = current.weather_desc || null;
      }
    }
    
    // Save to database
    await db.execute(`
      INSERT INTO weather_logs (adm4_code, location_name, weather_data, temperature, humidity, weather_desc)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      JAKARTA_ADM4,
      locationName,
      JSON.stringify(data),
      temperature,
      humidity,
      weatherDesc
    ]);
    
    // Clean up old logs (keep only last 7 days)
    await db.execute(`
      DELETE FROM weather_logs 
      WHERE fetched_at < NOW() - INTERVAL '7 days'
    `);
    
    console.log(`Weather saved: ${locationName}, Temp: ${temperature}°C, Humidity: ${humidity}%`);
    
    return {
      success: true,
      location: locationName,
      temperature,
      humidity,
      weather: weatherDesc,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Weather cron error:', error.message);
    throw error;
  }
}

// Vercel Serverless Function Handler
module.exports = async (req, res) => {
  // Verify cron secret (optional but recommended)
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const result = await fetchAndSaveWeather();
    
    res.status(200).json({
      success: true,
      message: 'Weather data saved successfully',
      data: result,
      nextRun: 'in 3 hours'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
