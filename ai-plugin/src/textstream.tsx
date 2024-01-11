import React,{ useState, useEffect, useRef } from 'react';
import { Box, Button } from '@material-ui/core';
import ReactMarkdown from 'react-markdown';
import MonacoEditor, {DiffEditor} from '@monaco-editor/react';
import * as jsYaml from 'js-yaml';
import './TextStream.css'; // Import the CSS file
import { useSnackbar } from 'notistack';
import { KubeObjectInterface } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { apply } from '@kinvolk/headlamp-plugin/lib/ApiProxy';
import { ConfirmDialog, Loader } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import Divider from '@material-ui/core/Divider';

const TextStreamContainer = ({ incomingText, callback, loading, context, resource }) => { 
  const [textStreamHistory, setTextStreamHistory] = useState<{
    incomingText: string;
    resource?: KubeObjectInterface;
    context: string;
  }[]>([]);

  useEffect(() => {
    if(!incomingText) {
      return
    }
    if(resource) {
      setTextStreamHistory([...textStreamHistory, {
        resource: resource,
        incomingText: incomingText,
        context
      }]);
      return;
    } else {
      setTextStreamHistory([...textStreamHistory, {
        incomingText: incomingText,
        context
      }]);
    }
    
  }, [incomingText]);

  if(textStreamHistory.length === 0 && loading) {
    return <Loader title=''/>;
  }

  if(textStreamHistory.length === 0 && !loading) {
    return null;
  }
  
  return (
    <div className="text-stream-container">
      {textStreamHistory.map(({
        incomingText,
        resource,
        context
      }, index) => (
        <>
        <Box className='text-stream'>
          <span style={{fontWeight: 'bold'}}>context: {context}</span>
        <TextStream incomingText={incomingText} callback={callback} resource={
          resource
        }/>
        </Box>
        <Divider/>
        </>
      ))}
      {
        loading && (
          <Loader title=''/>
        )
      }
    </div>
  );
}

const TextStream = ({ incomingText, callback, resource }) => {
  const messageContainerRef = useRef(null);
  const [yaml, setYaml] = useState('');
  const themeName = localStorage.getItem('headlampThemePreference');
  const { enqueueSnackbar } = useSnackbar();
  const [openAlert, setOpenAlert] = useState(false);
  // Scroll to the latest message when new messages arrive
  useEffect(() => {
    if (messageContainerRef.current) {
      messageContainerRef.current.scrollTop = messageContainerRef.current.scrollHeight;
    }

    const regex = /```([^```]+)```/g;
    const matches = incomingText.match(regex);
    if (matches) {
      const extractedStrings = matches.map(match => match.match(/```([^```]+)```/)[1]);
      setYaml(extractedStrings[0]);
    } else {
      console.log('No matches found.');
    }
  }, [incomingText]);

  return (
      <Box className={`text-stream-message`}>
        <ReactMarkdown>{incomingText.replace(/```[^`]+```/g, '')}</ReactMarkdown>
        {yaml !== '' && (
          <>
            { resource && <DiffEditor
             original={jsYaml.dump(resource)}
             modified={yaml}
             />
            }
            <MonacoEditor
              value={yaml}
              onChange={value => {
                if (!value) {
                  return;
                }
                setYaml(value);
              }}
              language="yaml"
              height="500px"
              options={{
                selectOnLineNumbers: true,
              }}
              theme={themeName === 'dark' ? 'vs-dark' : 'light'}
            />
            <Box mt={1} textAlign="right">
              <Button
                onClick={() => {
                  setOpenAlert(true);
                }}
              >
                Apply
              </Button>
              <ConfirmDialog
        open={openAlert}
        title={'Apply resource'}
        description={'Are you sure you want to apply this resource? Please verify as this is an AI generated yaml, make sure you know what you are doing here'}
        handleClose={() => setOpenAlert(false)}
        onConfirm={() => {
          console.log(jsYaml.load(yaml));
                  const resource = jsYaml.load(yaml);
                  apply(resource as KubeObjectInterface)
                    .then(() => {
                      enqueueSnackbar(`Resource applied successfully`, { variant: 'success' });
                      callback();
                    })
                    .catch(err => {
                      enqueueSnackbar(`Error applying resource: ${err}`, { variant: 'error' });
                    });
        }}
      />
            </Box>
          </>
        )}
      </Box>
  );
};

export default TextStreamContainer;
