import { AbstractParser, EnclosingContext } from "../../constants";
import * as treeSitter from 'tree-sitter';
import * as Python from 'tree-sitter-python';

interface TreeSitterNode {
  startPosition: {
    row: number;
  };
  endPosition: {
    row: number;
  };
  type: string;
  children: TreeSitterNode[];
}

export class PythonParser implements AbstractParser {
  private parser: any;

  constructor() {
    this.parser = new treeSitter();
    this.parser.setLanguage(Python);
  }

  private findLargestEnclosingNode(
    node: TreeSitterNode,
    lineStart: number,
    lineEnd: number,
    largestSize: number,
    largestEnclosingContext: TreeSitterNode | null
  ): { largestSize: number; largestEnclosingContext: TreeSitterNode | null } {
    // Check if this node encloses the target lines
    if (
      node.startPosition.row <= lineStart &&
      node.endPosition.row >= lineEnd
    ) {
      const size = node.endPosition.row - node.startPosition.row;
      if (size > largestSize) {
        return {
          largestSize: size,
          largestEnclosingContext: node,
        };
      }
    }

    return { largestSize, largestEnclosingContext };
  }

  private traverseTree(
    node: TreeSitterNode,
    lineStart: number,
    lineEnd: number,
    largestSize: number,
    largestEnclosingContext: TreeSitterNode | null
  ): { largestSize: number; largestEnclosingContext: TreeSitterNode | null } {
    // Check if this is a relevant node type
    if (
      ['function_definition', 'class_definition', 'async_function_definition', 'with_statement', 'try_statement']
        .includes(node.type)
    ) {
      ({ largestSize, largestEnclosingContext } = this.findLargestEnclosingNode(
        node,
        lineStart,
        lineEnd,
        largestSize,
        largestEnclosingContext
      ));
    }

    // Recursively check children
    if (node.children) {
      for (const child of node.children) {
        ({ largestSize, largestEnclosingContext } = this.traverseTree(
          child,
          lineStart,
          lineEnd,
          largestSize,
          largestEnclosingContext
        ));
      }
    }

    return { largestSize, largestEnclosingContext };
  }

  findEnclosingContext(
    file: string,
    lineStart: number,
    lineEnd: number
  ): EnclosingContext {
    try {
      const tree = this.parser.parse(file);
      const rootNode = tree.rootNode;

      const { largestEnclosingContext } = this.traverseTree(
        rootNode,
        lineStart - 1, // Convert to 0-based indexing
        lineEnd - 1,   // Convert to 0-based indexing
        0,
        null
      );

      return {
        enclosingContext: largestEnclosingContext,
      } as EnclosingContext;
    } catch (error) {
      console.error("Error parsing Python file:", error);
      return null;
    }
  }

  dryRun(file: string): { valid: boolean; error: string } {
    try {
      const tree = this.parser.parse(file);
      // If parsing succeeded and we have a valid syntax tree
      if (tree && tree.rootNode) {
        return {
          valid: true,
          error: "",
        };
      }
      return {
        valid: false,
        error: "Failed to parse Python file",
      };
    } catch (error) {
      return {
        valid: false,
        error: error.toString(),
      };
    }
  }
}