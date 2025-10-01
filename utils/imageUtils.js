const saveImageRecords = async (db, entityType, entityId, files) => {
  const imageRecords = [];
  
  for (const file of files) {
    // Store path with correct /pajar/uploads/ prefix
    const imagePath = `/pajar/uploads/${file.filename}`;
    
    const [result] = await db.execute(
      'INSERT INTO images (entity_type, entity_id, filename, original_name, mimetype, size, path) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [entityType, entityId, file.filename, file.originalname, file.mimetype, file.size, imagePath]
    );
    
    imageRecords.push({
      id: result.insertId,
      entity_type: entityType,
      entity_id: entityId,
      filename: file.filename,
      original_name: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: imagePath,
      created_at: new Date()
    });
  }
  
  return imageRecords;
};

module.exports = { saveImageRecords };