export const SAMPLE_SPEC = `openapi: 3.1.0
info:
  title: Petshop API
  version: 1.0.0
  description: A sample petshop API for the openapi-mocks playground.

servers:
  - url: http://playground.local

paths:
  /pets:
    get:
      operationId: listPets
      summary: List all pets
      tags: [pets]
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
        - name: status
          in: query
          schema:
            type: string
            enum: [available, pending, sold]
      responses:
        '200':
          description: A list of pets
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Pet'
    post:
      operationId: createPet
      summary: Create a pet
      tags: [pets]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Pet'
      responses:
        '201':
          description: Pet created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Pet'
        '422':
          description: Validation error
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /pets/{petId}:
    get:
      operationId: getPet
      summary: Get a pet by ID
      tags: [pets]
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: A pet
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Pet'
        '404':
          description: Pet not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
    delete:
      operationId: deletePet
      summary: Delete a pet
      tags: [pets]
      parameters:
        - name: petId
          in: path
          required: true
          schema:
            type: integer
      responses:
        '204':
          description: Pet deleted

  /owners:
    get:
      operationId: listOwners
      summary: List all owners
      tags: [owners]
      responses:
        '200':
          description: A list of owners
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Owner'

  /owners/{ownerId}:
    get:
      operationId: getOwner
      summary: Get an owner by ID
      tags: [owners]
      parameters:
        - name: ownerId
          in: path
          required: true
          schema:
            type: integer
      responses:
        '200':
          description: An owner
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Owner'
        '404':
          description: Owner not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

components:
  schemas:
    Pet:
      type: object
      required: [id, name, status]
      properties:
        id:
          type: integer
          x-faker-method: number.int
        name:
          type: string
          x-faker-method: animal.petName
        species:
          type: string
          enum: [dog, cat, rabbit, bird, fish]
        status:
          type: string
          enum: [available, pending, sold]
        birthDate:
          type: string
          format: date
          x-faker-method: date.past
        owner:
          $ref: '#/components/schemas/Owner'

    Owner:
      type: object
      required: [id, name, email]
      properties:
        id:
          type: integer
          x-faker-method: number.int
        name:
          type: string
          x-faker-method: person.fullName
        email:
          type: string
          format: email
          x-faker-method: internet.email
        phone:
          type: string
          x-faker-method: phone.number
        address:
          type: object
          properties:
            street:
              type: string
              x-faker-method: location.streetAddress
            city:
              type: string
              x-faker-method: location.city
            state:
              type: string
              x-faker-method: location.state
            zip:
              type: string
              x-faker-method: location.zipCode
            country:
              type: string
              x-faker-method: location.country

    Error:
      type: object
      required: [code, message]
      properties:
        code:
          type: integer
        message:
          type: string
`;
