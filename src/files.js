const express = require('express');
const fs = require('fs');
const path = require('path');
const { File } = require('./db');

const router = express.Router();

router.post('/upload', async (req, res) => {
  const file = req.files.file;

  if (!file) {
    return res.status(400).send({ message: 'No file uploaded' });
  }

  const ext = file.name.split('.').pop() || '';
  const newFile = await File.create({
    name: file.name,
    extension: ext,
    mimeType: file.mimetype,
    size: file.size,
  })

  const uploadPath = path.join(__dirname, '..', 'uploads')

  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }

  const filePath = path.join(uploadPath, `${newFile.id}.${newFile.extension}`)

  await file.mv(filePath);

  res.status(201).send({ message: 'File uploaded successfully', file: newFile });
})

router.get('/list', async (req, res) => {
  const listSize = parseInt(req.query.list_size, 10) || 10;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);

  const { count, rows } = await File.findAndCountAll({
    limit: listSize,
    offset: (page - 1) * listSize,
    order: [['uploadAt', 'DESC']]
  });

  res.status(200).send({ total: count, page, pageSize: listSize, files: rows });
})

router.delete('/delete/:id', async (req, res) => {
  const { id } = req.params;

  const file = await File.findOne({ where: { id } });

  if (file === null) {
    return res.status(404).send({ message: 'File not found' });
  }

  const uploadPath = path.join(__dirname, '..', 'uploads', `${file.id}.${file.extension}`)
  try {
    if (fs.existsSync(uploadPath)) {
      fs.unlinkSync(uploadPath);
    }
  } catch (e) {
    // ignore file-system errors
  }

  await File.destroy({ where: { id } });

  res.status(200).send({ message: 'File deleted successfully' });
})

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const file = await File.findOne({ where: { id } });

  if (file === null) {
    return res.status(404).send({ message: 'File not found' });
  }

  res.status(200).send({ file });
})

router.get('/download/:id', async (req, res) => {
  const { id } = req.params;

  const file = await File.findOne({ where: { id } });

  if (file === null) {
    return res.status(404).send({ message: 'File not found' });
  }

  const filePath = path.join(__dirname, '..', 'uploads', `${file.id}.${file.extension}`)
  if (!fs.existsSync(filePath)) {
    return res.status(404).send({ message: 'File not found on disk' });
  }
  res.download(filePath, file.name);
})

router.put('/update/:id', async (req, res) => {
  const file = req.files.file;
  const { id } = req.params;

  if (!file) {
    return res.status(400).send({ message: 'No file uploaded' });
  }

  const existingFile = await File.findOne({ where: { id } });

  if (existingFile === null) {
    return res.status(404).send({ message: 'File not found' });
  }

  const oldPath = path.join(__dirname, '..', 'uploads', `${existingFile.id}.${existingFile.extension}`)
  try {
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  } catch (e) { }

  const newExt = file.name.split('.').pop() || '';

  await File.update({
    name: file.name,
    extension: newExt,
    mimeType: file.mimetype,
    size: file.size
  }, { where: { id } });

  const newPath = path.join(__dirname, '..', 'uploads', `${existingFile.id}.${newExt}`)
  await file.mv(newPath);

  res.status(200).send({ message: 'File updated successfully' });
})

module.exports = router;