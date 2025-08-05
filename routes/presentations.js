const express = require('express');
const db = require('../db');
const router = express.Router();
const { getIo } = require('../index.js');

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM presentations ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ msg: 'Presentation name is required' });
    }
    const newPresentation = await db.query('INSERT INTO presentations (name) VALUES ($1) RETURNING *', [name]);
    const presentation = newPresentation.rows[0];
    await db.query('INSERT INTO slides (presentation_id, slide_order) VALUES ($1, 1)', [presentation.id]);
    getIo().emit('new_presentation', presentation);
    res.status(201).json(presentation);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query('SELECT * FROM presentations WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ msg: 'Presentation not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.get('/:id/slides', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query('SELECT * FROM slides WHERE presentation_id = $1 ORDER BY slide_order ASC', [id]);
    res.json(rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

router.post('/:id/slides', async (req, res) => {
  try {
    const { id: presentationId } = req.params;
    const { slideOrder } = req.body;

    const newSlide = await db.query(
      'INSERT INTO slides (presentation_id, slide_order) VALUES ($1, $2) RETURNING *',
      [presentationId, slideOrder]
    );
    const slide = newSlide.rows[0];

    getIo().to(presentationId).emit('new_slide_added', slide);
    
    res.status(201).json(slide);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});
// 👆

module.exports = router;