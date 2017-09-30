/**
 * Generates a file header based on the Swagen profile and definition details.
 * @param profile Swagen profile that is being processed
 * @param definition Swagen definition that is being processed
 * @returns {string[]} A string array of the lines in the generated header
 */
export function buildHeader(profile: Profile, definition: Definition): string[] {
    const header = [
        `//------------------------------`,
        `// <auto-generated>`,
        `//     Generated using the Swagen tool`,
        `//     Generator: ${profile.generator}`,
    ];
    if (profile.mode) {
        header.push(`//     Mode: ${profile.mode}`);
    }
    header.push(
        `// </auto-generated>`,
        `//------------------------------`,
    );
    if (definition && definition.metadata) {
        if (definition.metadata.title) {
            header.push(`// ${definition.metadata.title}`);
        }
        if (definition.metadata.description) {
            header.push(`// ${definition.metadata.description}`);
        }
        if (definition.metadata.baseUrl) {
            header.push(`// Base URL: ${definition.metadata.baseUrl}`);
        }
    }
    return header;
}

/**
 * Builds documentation comments for a given operation definition.
 * @param operation Operation definition
 * @returns {string[]} A string array of the lines in the generated doc comments.
 */
export function buildOperationDocComments(operation: Operation): string[] {
    const comments = [];
    if (operation.description) {
        comments.push(` * ${operation.description}`);
    }
    if (operation.description2) {
        comments.push(` * ${operation.description2}`);
    }
    const describedParams = (operation.parameters || []).filter(p => !!p.description);
    for (const describedParam of describedParams) {
        const dataType = getDataType(describedParam.dataType);
        comments.push(` * @param {${dataType}} ${describedParam.name} - ${describedParam.description}`);
    }
    if (comments.length > 0) {
        comments.unshift(`/**`);
        comments.push(` */`);
    }
    return comments;
}

/**
 * Returns the Typescript data type of the given property definition.
 * @param property Property definition
 * @param {string} ns Optional namespace to be prefixed for non-primitve types
 * @returns {string} The Typescript data type.
 */
export function getDataType(property: Property, ns?: string): string {
    let typeName: string;
    if (property.primitive) {
        typeName = getPrimitiveTypeName(property);
    } else if (property.complex) {
        typeName = prefixNamespace(property.complex, ns);
    } else if (property.enum) {
        typeName = prefixNamespace(property.enum, ns);
    } else {
        throw new Error(`Cannot understand type of property in definition: ${JSON.stringify(property, null, 4)}`);
    }
    return property.isArray ? typeName + '[]' : typeName;
}

function getPrimitiveTypeName(property: Property) {
    switch (property.primitive) {
        case 'integer':
        case 'number':
            return 'number';
        case 'string': {
            switch (property.subType) {
                case 'date-time':
                    return 'Date';
                case 'uuid':
                    return 'string';
                case 'byte':
                    return 'number';
                default:
                    return 'string';
            }
        }
        case 'boolean':
            return 'boolean';
        case 'file':
        case 'object':
            return 'any';
        default:
            throw new Error(`Cannot translate primitive type ${JSON.stringify(property, null, 4)}`);
    }
}

function prefixNamespace(name: string, ns: string) {
    return ns ? `${ns}.${name}` : name;
}

/**
 * Creates a Typescript method signature from the given operation details.
 * @param {string} operationName Name of the operation
 * @param operation Operation definition
 * @param options Options to customize generation
 * @returns {string} A string containing the method signature
 */
export function getMethodSignature(
    operationName: string,
    operation: Operation,
    options: MethodSignatureOptions,
): string {
    const parameters = (operation.parameters || []).reduce((accumulate, parameter) => {
        if (accumulate) {
            accumulate += ', ';
        }
        accumulate += `${parameter.name}: ${getDataType(parameter.dataType, options.modelsNs)}`;
        return accumulate;
    }, '');

    let returnType = getReturnType(operation, options);
    if (typeof options.returnTypeTransformer === 'function') {
        returnType = options.returnTypeTransformer(returnType);
    }

    const methodSig = `${operationName}(${parameters}): ${returnType}`;
    return methodSig;
}

/**
 * Returns a Typescript data type from the responses of the given operation definition.
 * @param operation Operation definition
 * @param options Options to customize return type
 * @returns {string} Typescript data type of the operation's responses.
 */
export function getReturnType(operation: Operation, options: ReturnTypeOptions): string {
    if (!operation.responses) {
        return options.voidType || 'void';
    }

    for (const statusKey in operation.responses) {
        if (operation.responses.hasOwnProperty(statusKey)) {
            const statusCode = +statusKey;
            if (statusCode >= 200 && statusCode < 300 && operation.responses[statusKey].dataType) {
                return getDataType(operation.responses[statusKey].dataType, options.modelsNs);
            }
        }
    }

    return options.voidType || 'void';
}

export interface Profile {
    generator: string;
    mode: string;
}

export interface Definition {
    metadata: {
        title: string;
        description: string;
        baseUrl: string;
    };
}

export interface Property {
    primitive?: 'integer'|'number'|'string'|'boolean'|'file'|'object';
    subType?: 'date-time'|'uuid'|'byte';
    complex?: string;
    enum?: string;
    isArray: boolean;
}

export interface Operation {
    description: string;
    description2: string;
    parameters: {
        name: string;
        description: string;
        dataType: Property;
    }[];
    responses: {
        dataType: Property;
    }[];
}

export interface ReturnTypeOptions {
    modelsNs?: string;
    voidType?: 'void' | 'any' | 'string' | 'Object' | 'object' | '{}';
}

export interface MethodSignatureOptions extends ReturnTypeOptions {
    returnTypeTransformer: (returnType: string) => string;
}