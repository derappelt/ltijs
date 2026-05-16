import mongoose from 'mongoose'
import crypto from 'crypto'
import debug from 'debug'
import { DatabaseConfig } from '../types/shared'

const Schema = mongoose.Schema
const provDatabaseDebug = debug('provider:database')

interface EncryptedPayload {
  iv: string
  data: string
}

/**
 * @description Collection of static methods to manipulate the database.
 */
class Database {
  #dbUrl: string

  #dbConnection: Record<string, unknown> = {
    useNewUrlParser: true,
    connectTimeoutMS: 300000,
    useUnifiedTopology: true
  }

  #deploy = false

  db: mongoose.Connection

  /**
   * @description Mongodb configuration setup
   * @param {Object} database - Configuration object
   */
  constructor (database: DatabaseConfig) {
    if (!database || !database.url) throw new Error('MISSING_DATABASE_CONFIG')

    // Configures database connection
    this.#dbUrl = database.url
    if (database.debug) mongoose.set('debug', true)

    this.#dbConnection = {
      ...this.#dbConnection,
      ...database.connection
    }

    // Creating database schemas
    const idTokenSchema = new Schema({
      iss: String,
      user: String,
      userInfo: (JSON as any),
      platformInfo: (JSON as any),
      clientId: String,
      platformId: String,
      deploymentId: String,
      createdAt: { type: Date, expires: 3600 * 24, default: Date.now }
    })
    idTokenSchema.index({ iss: 1, clientId: 1, deploymentId: 1, user: 1 })

    const contextTokenSchema = new Schema({
      contextId: String,
      user: String,
      roles: [String],
      path: String,
      targetLinkUri: String,
      context: (JSON as any),
      resource: (JSON as any),
      custom: (JSON as any),
      launchPresentation: (JSON as any),
      messageType: String,
      version: String,
      deepLinkingSettings: (JSON as any),
      lis: (JSON as any),
      endpoint: (JSON as any),
      namesRoles: (JSON as any),
      createdAt: { type: Date, expires: 3600 * 24, default: Date.now }
    })
    contextTokenSchema.index({ contextId: 1, user: 1 })

    const platformSchema = new Schema({
      platformUrl: String,
      platformName: String,
      clientId: String,
      authEndpoint: String,
      accesstokenEndpoint: String,
      authorizationServer: String,
      kid: String,
      authConfig: {
        method: String,
        key: String
      }
    })
    platformSchema.index({ platformUrl: 1 })
    platformSchema.index({ kid: 1 }, { unique: true })
    platformSchema.index({ platformUrl: 1, clientId: 1 }, { unique: true })

    const platformStatusSchema = new Schema({
      id: String,
      active: { type: Boolean, default: false }
    })
    platformStatusSchema.index({ id: 1 }, { unique: true })

    const keySchema = new Schema({
      kid: String,
      platformUrl: String,
      clientId: String,
      iv: String,
      data: String
    })
    keySchema.index({ kid: 1 }, { unique: true })

    const accessTokenSchema = new Schema({
      platformUrl: String,
      clientId: String,
      scopes: String,
      iv: String,
      data: String,
      createdAt: { type: Date, expires: 3600, default: Date.now }
    })
    accessTokenSchema.index({ platformUrl: 1, clientId: 1, scopes: 1 }, { unique: true })

    const nonceSchema = new Schema({
      nonce: String,
      createdAt: { type: Date, expires: 10, default: Date.now }
    })
    nonceSchema.index({ nonce: 1 })

    const stateSchema = new Schema({
      state: String,
      query: (JSON as any),
      createdAt: { type: Date, expires: 600, default: Date.now }
    })
    stateSchema.index({ state: 1 }, { unique: true })

    try {
      mongoose.model('idtoken', idTokenSchema)
      mongoose.model('contexttoken', contextTokenSchema)
      mongoose.model('platform', platformSchema)
      mongoose.model('platformStatus', platformStatusSchema)
      mongoose.model('privatekey', keySchema)
      mongoose.model('publickey', keySchema)
      mongoose.model('accesstoken', accessTokenSchema)
      mongoose.model('nonce', nonceSchema)
      mongoose.model('state', stateSchema)
    } catch (err) {
      provDatabaseDebug('Model already registered. Continuing')
    }

    this.db = mongoose.connection
  }

  /**
   * @description Opens connection to database
   */
  async setup (): Promise<boolean> {
    this.db.on('connected', async () => {
      provDatabaseDebug('Database connected')
    })
    this.db.once('open', async () => {
      provDatabaseDebug('Database connection open')
    })
    this.db.on('error', async () => {
      mongoose.disconnect()
    })
    this.db.on('reconnected', async () => {
      provDatabaseDebug('Database reconnected')
    })
    this.db.on('disconnected', async () => {
      provDatabaseDebug('Database disconnected')
      provDatabaseDebug('Attempting to reconnect')
      setTimeout(async () => {
        if (this.db.readyState === 0) {
          try {
            await mongoose.connect(this.#dbUrl, this.#dbConnection as mongoose.ConnectOptions)
          } catch (err) {
            provDatabaseDebug('Error in MongoDb connection: ' + err)
          }
        }
      }, 1000)
    })

    if (this.db.readyState === 0) await mongoose.connect(this.#dbUrl, this.#dbConnection as mongoose.ConnectOptions)
    this.#deploy = true
    return true
  }

  // Closes connection to the database
  async Close (): Promise<boolean> {
    mongoose.connection.removeAllListeners()
    await mongoose.connection.close()
    this.#deploy = false
    return true
  }

  /**
   * @description Get item or entire database.
   * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none
   * @param {String} collection - The collection to be accessed inside the database.
   * @param {Object} [query] - Query for the item you are looking for in the format {type: "type1"}.
   */
  async Get (ENCRYPTIONKEY: string | false, collection: string, query?: Record<string, unknown>): Promise<any[] | false> {
    if (!this.#deploy) throw new Error('PROVIDER_NOT_DEPLOYED')
    if (!collection) throw new Error('MISSING_COLLECTION')

    const Model = mongoose.model(collection)
    const result: any[] = await Model.find(query as any).select('-__v -_id')

    if (ENCRYPTIONKEY) {
      for (const i in result) {
        const temp = result[i]
        result[i] = JSON.parse(await this.Decrypt(result[i].data, result[i].iv, ENCRYPTIONKEY))
        if (temp.createdAt) {
          const createdAt = Date.parse(temp.createdAt)
          result[i].createdAt = createdAt
        }
      }
    }

    if (result.length === 0) return false
    return result
  }

  /**
   * @description Insert item in database.
   * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none.
   * @param {String} collection - The collection to be accessed inside the database.
   * @param {Object} item - The item Object you want to insert in the database.
   * @param {Object} [index] - Key that should be used as index in case of Encrypted document.
   */
  async Insert (ENCRYPTIONKEY: string | false, collection: string, item: Record<string, unknown>, index?: Record<string, unknown>): Promise<boolean> {
    if (!this.#deploy) throw new Error('PROVIDER_NOT_DEPLOYED')
    if (!collection || !item || (ENCRYPTIONKEY && !index)) throw new Error('MISSING_PARAMS')

    const Model = mongoose.model(collection)
    let newDocData: Record<string, unknown> = item
    if (ENCRYPTIONKEY) {
      const encrypted = await this.Encrypt(JSON.stringify(item), ENCRYPTIONKEY)
      newDocData = {
        ...index,
        iv: encrypted.iv,
        data: encrypted.data
      }
    }
    const newDoc = new Model(newDocData)
    await newDoc.save()
    return true
  }

  /**
   * @description Replace item in database. Creates a new document if it does not exist.
   * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none.
   * @param {String} collection - The collection to be accessed inside the database.
   * @param {Object} query - Query for the item you are looking for in the format {type: "type1"}.
   * @param {Object} item - The item Object you want to insert in the database.
   * @param {Object} [index] - Key that should be used as index in case of Encrypted document.
   */
  async Replace (ENCRYPTIONKEY: string | false, collection: string, query: Record<string, unknown>, item: Record<string, unknown>, index?: Record<string, unknown>): Promise<boolean> {
    if (!this.#deploy) throw new Error('PROVIDER_NOT_DEPLOYED')
    if (!collection || !item || (ENCRYPTIONKEY && !index)) throw new Error('MISSING_PARAMS')

    const Model = mongoose.model(collection)
    let newDocData: Record<string, unknown> = item
    if (ENCRYPTIONKEY) {
      const encrypted = await this.Encrypt(JSON.stringify(item), ENCRYPTIONKEY)
      newDocData = {
        ...index,
        iv: encrypted.iv,
        data: encrypted.data
      }
    }

    await Model.replaceOne(query as any, newDocData, { upsert: true })
    return true
  }

  /**
   * @description Assign value to item in database
   * @param {String} ENCRYPTIONKEY - Encryptionkey of the database, false if none.
   * @param {String} collection - The collection to be accessed inside the database.
   * @param {Object} query - The entry you want to modify in the format {type: "type1"}.
   * @param {Object} modification - The modification you want to make in the format {type: "type2"}.
   */
  async Modify (ENCRYPTIONKEY: string | false, collection: string, query: Record<string, unknown>, modification: Record<string, unknown>): Promise<boolean> {
    if (!this.#deploy) throw new Error('PROVIDER_NOT_DEPLOYED')
    if (!collection || !query || !modification) throw new Error('MISSING_PARAMS')

    const Model = mongoose.model(collection)

    let newMod: Record<string, unknown> = modification
    if (ENCRYPTIONKEY) {
      let result: any = await Model.findOne(query as any)
      if (result) {
        result = JSON.parse(await this.Decrypt(result.data, result.iv, ENCRYPTIONKEY))
        result[Object.keys(modification)[0]] = Object.values(modification)[0]
        newMod = await this.Encrypt(JSON.stringify(result), ENCRYPTIONKEY) as unknown as Record<string, unknown>
      }
    }

    await Model.updateOne(query as any, newMod as any)
    return true
  }

  /**
   * @description Delete item in database
   * @param {String} collection - The collection to be accessed inside the database.
   * @param {Object} query - The entry you want to delete in the format {type: "type1"}.
   */
  async Delete (collection: string, query: Record<string, unknown>): Promise<boolean> {
    if (!this.#deploy) throw new Error('PROVIDER_NOT_DEPLOYED')
    if (!collection || !query) throw new Error('MISSING_PARAMS')
    const Model = mongoose.model(collection)
    await Model.deleteMany(query as any)
    return true
  }

  /**
   * @description Encrypts data.
   * @param {String} data - Data to be encrypted
   * @param {String} secret - Secret used in the encryption
   */
  async Encrypt (data: string, secret: string): Promise<EncryptedPayload> {
    const hash = crypto.createHash('sha256')
    hash.update(secret)
    const key = hash.digest().slice(0, 32)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
    let encrypted = cipher.update(data)
    encrypted = Buffer.concat([encrypted, cipher.final()])
    return { iv: iv.toString('hex'), data: encrypted.toString('hex') }
  }

  /**
   * @description Decrypts data.
   * @param {String} data - Data to be decrypted
   * @param {String} _iv - Encryption iv
   * @param {String} secret - Secret used in the encryption
   */
  async Decrypt (data: string, _iv: string, secret: string): Promise<string> {
    const hash = crypto.createHash('sha256')
    hash.update(secret)
    const key = hash.digest().slice(0, 32)
    const iv = Buffer.from(_iv, 'hex')
    const encryptedText = Buffer.from(data, 'hex')
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv)
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
  }
}

export = Database
