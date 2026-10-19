import * as categoryService from '../services/category.service.js';
import { AppError } from '../utils/AppError.js';

export const getCategories = async (req, res) => {
  const categories = await categoryService.getCategories();
  res.json(categories);
};

export const createCategory = async (req, res) => {
  const { name } = req.body;
  
  const newCategory = await categoryService.createCategory(name).catch(err => {
    if (err.message === 'Category already exists') {
      throw new AppError(err.message, 409);
    }
    throw err;
  });

  res.status(201).json(newCategory);
};

export const getCategoryById = async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);
  res.json(category);
};
