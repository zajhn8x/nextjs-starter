import React from 'react'
import Router from 'next/router'
import Link from 'next/link'
import fetch from 'isomorphic-fetch'
import { Row, Col, Form, FormGroup, Label, Input, Button } from 'reactstrap'
import { NextAuth } from 'next-auth/client'
import Page from '../components/page'
import Layout from '../components/layout'
import Cookies from 'universal-cookie'
import ReactCrop from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css';
export default class extends Page {

  static async getInitialProps({req}) {
    let props = await super.getInitialProps({req})
    props.linkedAccounts = await NextAuth.linked({req})
    return props
  }

  constructor(props) {
    super(props)
    this.state = {
      session: props.session,
      isSignedIn: (props.session.user) ? true : false,
      name: '',
      email: '',
      address: '',
      emailVerified: false,
      alertText: null,
      alertStyle: null,
      src: null,
      crop: {
            aspect: 1,
            width: 50,
            x: 0,
            y: 0,
        },
      }
    if (props.session.user) {
      this.state.name = props.session.user.name
      this.state.email = props.session.user.email
    }
    this.handleChange = this.handleChange.bind(this)
    this.onSubmit = this.onSubmit.bind(this)
  }

  async componentDidMount() {
    const session = await NextAuth.init({force: true})
    this.setState({
      session: session,
      isSignedIn: (session.user) ? true : false
    })

    /*====avatart */



    // If the user bounces off to link/unlink their account we want them to
    // land back here after signing in with the other service / unlinking.
    const cookies = new Cookies()
    cookies.set('redirect_url', window.location.pathname, { path: '/' })
    
    this.getProfile()
  }
    /*====avatart */
    onSelectFile = e => {
        if (e.target.files && e.target.files.length > 0) {
            const reader = new FileReader();
            reader.addEventListener('load', () =>
                this.setState({ src: reader.result }),
            );
            reader.readAsDataURL(e.target.files[0]);
        }
    };

    onImageLoaded = (image, pixelCrop) => {
        this.imageRef = image;

        // Make the library regenerate aspect crops if loading new images.
        const { crop } = this.state;

        if (crop.aspect && crop.height && crop.width) {
            this.setState({
                crop: { ...crop, height: null },
            });
        } else {
            this.makeClientCrop(crop, pixelCrop);
        }
    };

    onCropComplete = (crop, pixelCrop) => {
        this.makeClientCrop(crop, pixelCrop);
    };

    onCropChange = crop => {
        this.setState({ crop });
    };
    getCroppedImg = (image, pixelCrop, fileName) => {
        const canvas = document.createElement('canvas');
        canvas.width = pixelCrop.width;
        canvas.height = pixelCrop.height;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(
            image,
            pixelCrop.x,
            pixelCrop.y,
            pixelCrop.width,
            pixelCrop.height,
            0,
            0,
            pixelCrop.width,
            pixelCrop.height,
        );

        return new Promise((resolve, reject) => {
            canvas.toBlob(blob => {
                blob.name = fileName;
                window.URL.revokeObjectURL(this.fileUrl);
                this.fileUrl = window.URL.createObjectURL(blob);
                resolve(this.fileUrl);
            }, 'image/jpeg');
        });
    }
  async makeClientCrop (crop, pixelCrop){
        if (this.imageRef && crop.width && crop.height) {
            const croppedImageUrl = await this.getCroppedImg(
                this.imageRef,
                pixelCrop,
                'newFile.jpeg',
            );
            this.setState({ croppedImageUrl });
        }
  }
  
  getProfile() {
    fetch('/account/user', {
      credentials: 'include'
    })
    .then(r => r.json())
    .then(user => {
      if (!user.name || !user.email) return
      this.setState({
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        address: user.address,
        srcAvatar: user.srcAvatar || ''
      })
    })

  }
  
  handleChange(event) {
    this.setState({
      [event.target.name]: event.target.value
    })
  }

  async onSubmit(e) {
    // Submits the URL encoded form without causing a page reload
    e.preventDefault()
    
    this.setState({
      alertText: null,
      alertStyle: null
    })
    
    const formData = {
      _csrf: await NextAuth.csrfToken(),
      name: this.state.name || '',
      email: this.state.email || '',
      address: this.state.address || '',
      src: this.state.croppedImageUrl  || ''
    }
    
    // URL encode form
    // Note: This uses a x-www-form-urlencoded rather than sending JSON so that
    // the form also in browsers without JavaScript
    const encodedForm = Object.keys(formData).map((key) => {
      return encodeURIComponent(key) + '=' + encodeURIComponent(formData[key])
    }).join('&')
    
    fetch('/account/user', {
      credentials: 'include',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: encodedForm
    })
    .then(async res => {
      if (res.status === 200) {
        this.getProfile()
        this.setState({
          alertText: 'Changes to your profile have been saved',
          alertStyle: 'alert-success',
        })
        // Force update session so that changes to name or email are reflected
        // immediately in the navbar (as we pass our session to it).
        this.setState({
          session: await NextAuth.init({force: true}), // Update session data
          srcAvatar: this.state.croppedImageUrl
        })
      } else {
        this.setState({
          session: await NextAuth.init({force: true}), // Update session data
          alertText: 'Failed to save changes to your profile',
          alertStyle: 'alert-danger',
        })
      }
    })
  }
  
  render() {
    if (this.state.isSignedIn === true) {
      const alert = (this.state.alertText === null) ? <div/> : <div className={`alert ${this.state.alertStyle}`} role="alert">{this.state.alertText}</div>
      const { crop, croppedImageUrl, src } = this.state;
      return (
        <Layout {...this.props} navmenu={false}>
          <Row className="mb-1">
            <Col xs="12">
              <h1 className="display-2">Your Account</h1>
              <p className="lead text-muted">
                Edit your profile and link accounts
              </p>
            </Col>
          </Row>
          {alert}
          <Row className="mt-4">
            <Col xs="12" md="8" lg="9">
              <Form method="post" action="/account/user" onSubmit={this.onSubmit}>
                <Input name="_csrf" type="hidden" value={this.state.session.csrfToken} onChange={()=>{}}/>
                <FormGroup row>
                  <Label sm={2}>Avatar:</Label>
                  <Col sm={10} md={8}>
                    <img width="100" height="100" src={this.state.srcAvatar} />
                    <input type="file" onChange={this.onSelectFile} />
                      {src && (
                        <ReactCrop src={src} crop={this.state.crop}
                            onImageLoaded={this.onImageLoaded}
                            onComplete={this.onCropComplete}
                            onChange={this.onCropChange} />
                      )}
                      {croppedImageUrl && <img alt="Crop" src={croppedImageUrl} />}
                  </Col>
                </FormGroup>
                <FormGroup row>
                  <Label sm={2}>Name:</Label>
                  <Col sm={10} md={8}>
                    <Input name="name" value={this.state.name} onChange={this.handleChange}/>
                  </Col>
                </FormGroup>
                <FormGroup row>
                  <Label sm={2}>Email:</Label>
                  <Col sm={10} md={8}>
                    <Input name="email" value={(this.state.email.match(/.*@localhost\.localdomain$/)) ? '' : this.state.email} onChange={this.handleChange}/>
                  </Col>
                </FormGroup>
                <FormGroup row>
                  <Label sm={2}>Address:</Label>
                  <Col sm={10} md={8}>
                    <Input name="address" value={this.state.address} onChange={this.handleChange}/>
                  </Col>
                </FormGroup>
                <FormGroup row>
                  <Col sm={12} md={10}>
                    <p className="text-right">
                      <Button color="primary" type="submit" ><span className="icon icon-spin ion-md-refresh mr-2"/>Save Changes</Button>
                    </p>
                  </Col>
                </FormGroup>
              </Form>
            </Col>
            <Col xs="12" md="4" lg="3">
            <LinkAccounts
              session={this.props.session}
              linkedAccounts={this.props.linkedAccounts}
              />
            </Col>
          </Row>
          <Row>
            <Col>
              <h2>Delete your account</h2>
              <p>
                If you delete your account it will be erased immediately.
                You can sign up again at any time.
              </p>
              <Form id="signout" method="post" action="/account/delete">
                <input name="_csrf" type="hidden" value={this.state.session.csrfToken}/>
                <Button type="submit" color="outline-danger"><span className="icon ion-md-trash mr-1"></span> Delete Account</Button>
              </Form>
            </Col>
          </Row>
            <style>{`
           .ReactCrop {
  position: relative;
  display: inline-block;
  cursor: crosshair;
  overflow: hidden;
  max-width: 100%;
  background-color: #000; }
  .ReactCrop:focus {
    outline: none; }
  .ReactCrop--disabled {
    cursor: inherit; }
  .ReactCrop__image {
    / autoprefixer: off /
    display: block;
    max-width: 100%;
    max-height: -webkit-fill-available;
    max-height: -moz-available;
    max-height: stretch; }
  .ReactCrop--crop-invisible .ReactCrop__image {
    opacity: 0.5; }
  .ReactCrop__crop-selection {
    position: absolute;
    top: 0;
    left: 0;
    transform: translate3d(0, 0, 0);
    box-sizing: border-box;
    cursor: move;
    box-shadow: 0 0 0 9999em rgba(0, 0, 0, 0.5);
    border: 1px solid;
    border-image-source: url("data:image/gif;base64,R0lGODlhCgAKAJECAAAAAP///////wAAACH/C05FVFNDQVBFMi4wAwEAAAAh/wtYTVAgRGF0YVhNUDw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iIHhtbG5zOnN0UmVmPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvc1R5cGUvUmVzb3VyY2VSZWYjIiB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6OEI5RDc5MTFDNkE2MTFFM0JCMDZEODI2QTI4MzJBOTIiIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6OEI5RDc5MTBDNkE2MTFFM0JCMDZEODI2QTI4MzJBOTIiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoTWFjaW50b3NoKSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuZGlkOjAyODAxMTc0MDcyMDY4MTE4MDgzQzNDMjA5MzREQ0ZDIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjAyODAxMTc0MDcyMDY4MTE4MDgzQzNDMjA5MzREQ0ZDIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+Af/+/fz7+vn49/b19PPy8fDv7u3s6+rp6Ofm5eTj4uHg397d3Nva2djX1tXU09LR0M/OzczLysnIx8bFxMPCwcC/vr28u7q5uLe2tbSzsrGwr66trKuqqainpqWko6KhoJ+enZybmpmYl5aVlJOSkZCPjo2Mi4qJiIeGhYSDgoGAf359fHt6eXh3dnV0c3JxcG9ubWxramloZ2ZlZGNiYWBfXl1cW1pZWFdWVVRTUlFQT05NTEtKSUhHRkVEQ0JBQD8+PTw7Ojk4NzY1NDMyMTAvLi0sKyopKCcmJSQjIiEgHx4dHBsaGRgXFhUUExIREA8ODQwLCgkIBwYFBAMCAQAAIfkEBQoAAgAsAAAAAAoACgAAAhWEERkn7W3ei7KlagMWF/dKgYeyGAUAIfkEBQoAAgAsAAAAAAoACgAAAg+UYwLJ7RnQm7QmsCyVKhUAIfkEBQoAAgAsAAAAAAoACgAAAhCUYgLJHdiinNSAVfOEKoUCACH5BAUKAAIALAAAAAAKAAoAAAIRVISAdusPo3RAzYtjaMIaUQAAIfkEBQoAAgAsAAAAAAoACgAAAg+MDiem7Q8bSLFaG5il6xQAIfkEBQoAAgAsAAAAAAoACgAAAg+UYRLJ7QnQm7SmsCyVKhUAIfkEBQoAAgAsAAAAAAoACgAAAhCUYBLJDdiinNSEVfOEKoECACH5BAUKAAIALAAAAAAKAAoAAAIRFISBdusPo3RBzYsjaMIaUQAAOw==");
    border-image-slice: 1;
    border-image-repeat: repeat; }
    .ReactCrop--disabled .ReactCrop__crop-selection {
      cursor: inherit; }
  .ReactCrop__drag-handle {
    position: absolute;
    width: 9px;
    height: 9px;
    background-color: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.7);
    box-sizing: border-box;
    outline: 1px solid transparent; }
  .ReactCrop .ord-nw {
    top: 0;
    left: 0;
    margin-top: -5px;
    margin-left: -5px;
    cursor: nw-resize; }
  .ReactCrop .ord-n {
    top: 0;
    left: 50%;
    margin-top: -5px;
    margin-left: -5px;
    cursor: n-resize; }
  .ReactCrop .ord-ne {
    top: 0;
    right: 0;
    margin-top: -5px;
    margin-right: -5px;
    cursor: ne-resize; }
  .ReactCrop .ord-e {
    top: 50%;
    right: 0;
    margin-top: -5px;
    margin-right: -5px;
    cursor: e-resize; }
  .ReactCrop .ord-se {
    bottom: 0;
    right: 0;
    margin-bottom: -5px;
    margin-right: -5px;
    cursor: se-resize; }
  .ReactCrop .ord-s {
    bottom: 0;
    left: 50%;
    margin-bottom: -5px;
    margin-left: -5px;
    cursor: s-resize; }
  .ReactCrop .ord-sw {
    bottom: 0;
    left: 0;
    margin-bottom: -5px;
    margin-left: -5px;
    cursor: sw-resize; }
  .ReactCrop .ord-w {
    top: 50%;
    left: 0;
    margin-top: -5px;
    margin-left: -5px;
    cursor: w-resize; }
  .ReactCrop__disabled .ReactCrop__drag-handle {
    cursor: inherit; }
  .ReactCrop__drag-bar {
    position: absolute; }
    .ReactCrop__drag-bar.ord-n {
      top: 0;
      left: 0;
      width: 100%;
      height: 6px;
      margin-top: -3px; }
    .ReactCrop__drag-bar.ord-e {
      right: 0;
      top: 0;
      width: 6px;
      height: 100%;
      margin-right: -3px; }
    .ReactCrop__drag-bar.ord-s {
      bottom: 0;
      left: 0;
      width: 100%;
      height: 6px;
      margin-bottom: -3px; }
    .ReactCrop__drag-bar.ord-w {
      top: 0;
      left: 0;
      width: 6px;
      height: 100%;
      margin-left: -3px; }
  .ReactCrop--new-crop .ReactCrop__drag-bar,
  .ReactCrop--new-crop .ReactCrop__drag-handle,
  .ReactCrop--fixed-aspect .ReactCrop__drag-bar {
    display: none; }
  .ReactCrop--fixed-aspect .ReactCrop__drag-handle.ord-n,
  .ReactCrop--fixed-aspect .ReactCrop__drag-handle.ord-e,
  .ReactCrop--fixed-aspect .ReactCrop__drag-handle.ord-s,
  .ReactCrop--fixed-aspect .ReactCrop__drag-handle.ord-w {
    display: none; }
  @media (max-width: 768px), (pointer: coarse) {
    .ReactCrop__drag-handle {
      width: 17px;
      height: 17px; }
    .ReactCrop .ord-nw {
      margin-top: -9px;
      margin-left: -9px; }
    .ReactCrop .ord-n {
      margin-top: -9px;
      margin-left: -9px; }
    .ReactCrop .ord-ne {
      margin-top: -9px;
      margin-right: -9px; }
    .ReactCrop .ord-e {
      margin-top: -9px;
      margin-right: -9px; }
    .ReactCrop .ord-se {
      margin-bottom: -9px;
      margin-right: -9px; }
    .ReactCrop .ord-s {
      margin-bottom: -9px;
      margin-left: -9px; }
    .ReactCrop .ord-sw {
      margin-bottom: -9px;
      margin-left: -9px; }
    .ReactCrop .ord-w {
      margin-top: -9px;
      margin-left: -9px; }
    .ReactCrop__drag-bar.ord-n {
      height: 14px;
      margin-top: -7px; }
    .ReactCrop__drag-bar.ord-e {
      width: 14px;
      margin-right: -7px; }
    .ReactCrop__drag-bar.ord-s {
      height: 14px;
      margin-bottom: -7px; }
    .ReactCrop__drag-bar.ord-w {
      width: 14px;
      margin-left: -7px; } }
      .image-upload > input
      {
          display: none;
      }

      .image-upload i
      {
          width: 20px;
          cursor: pointer;
      }
        `}</style>
        </Layout>
      )
    } else {
      return (
        <Layout {...this.props} navmenu={false}>
          <Row>
            <Col xs="12" className="text-center pt-5 pb-5">
              <p className="lead m-0">
                <Link href="/auth"><a>Sign in to manage your profile</a></Link>
              </p>
            </Col>
          </Row>
        </Layout>
      )
    }
  }
}

export class LinkAccounts extends React.Component {
  render() {
    return (
      <React.Fragment>
        {
          Object.keys(this.props.linkedAccounts).map((provider, i) => {
            return <LinkAccount key={i} provider={provider} session={this.props.session} linked={this.props.linkedAccounts[provider]}/>
          })
        }
      </React.Fragment>
    )
  }
}

export class LinkAccount extends React.Component {
  render() {
    if (this.props.linked === true) {
      return (
        <form method="post" action={`/auth/oauth/${this.props.provider.toLowerCase()}/unlink`}>
          <input name="_csrf" type="hidden" value={this.props.session.csrfToken}/>
          <p>
            <button className="btn btn-block btn-outline-danger" type="submit">
              Unlink from {this.props.provider}
            </button>
          </p>
        </form>
      )
    } else {
      return (
        <p>
          <a className="btn btn-block btn-outline-primary" href={`/auth/oauth/${this.props.provider.toLowerCase()}`}>
            Link with {this.props.provider}
          </a>
        </p>
      )
    }
  }
}