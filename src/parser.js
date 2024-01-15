import Parser from "tree-sitter";
import Json from "tree-sitter-json";


export const parser = new Parser();
parser.setLanguage(Json);
